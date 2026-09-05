import * as CFB from "cfb";
import aesjs from "aes-js";
import { sha1 as sha1Lib } from "js-sha1";
import { sha256 as sha256Lib } from "js-sha256";
import { sha512 as sha512Lib } from "js-sha512";

export class WrongPasswordError extends Error {
  constructor(message = "비밀번호가 맞지 않아요") {
    super(message);
    this.name = "WrongPasswordError";
  }
}

function asBytes(content: number[] | Uint8Array | undefined): Uint8Array {
  if (!content) return new Uint8Array();
  return content instanceof Uint8Array ? content : Uint8Array.from(content);
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function u16le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32le(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function packU32le(value: number): Uint8Array {
  const out = new Uint8Array(4);
  out[0] = value & 0xff;
  out[1] = (value >>> 8) & 0xff;
  out[2] = (value >>> 16) & 0xff;
  out[3] = (value >>> 24) & 0xff;
  return out;
}

function utf16leEncode(value: string): Uint8Array {
  const out = new Uint8Array(value.length * 2);
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    out[i * 2] = code & 0xff;
    out[i * 2 + 1] = code >>> 8;
  }
  return out;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07);
}

function sha1(message: Uint8Array): Uint8Array {
  return new Uint8Array(sha1Lib.arrayBuffer(message));
}

function sha256(message: Uint8Array): Uint8Array {
  return new Uint8Array(sha256Lib.arrayBuffer(message));
}

function sha512(message: Uint8Array): Uint8Array {
  return new Uint8Array(sha512Lib.arrayBuffer(message));
}

type HashName = "SHA1" | "SHA256" | "SHA512";

function normalizeHash(name: string): HashName {
  const n = name.replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (n === "SHA1" || n === "SHA256" || n === "SHA512") return n;
  throw new Error("지원하지 않는 엑셀 암호 방식이에요");
}

function hashBytes(name: HashName, ...parts: Uint8Array[]): Uint8Array {
  const message = parts.length === 1 ? parts[0] : concatBytes(...parts);
  if (name === "SHA1") return sha1(message);
  if (name === "SHA256") return sha256(message);
  return sha512(message);
}

function hashSize(name: HashName): number {
  if (name === "SHA1") return 20;
  if (name === "SHA256") return 32;
  return 64;
}

function aesEcbDecrypt(data: Uint8Array, key: Uint8Array): Uint8Array {
  if (data.length === 0) return data;
  if (data.length % 16 !== 0) throw new Error("암호 블록이 올바르지 않아요");
  const aes = new aesjs.ModeOfOperation.ecb(key);
  return Uint8Array.from(aes.decrypt(data));
}

function aesCbcDecrypt(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
  if (data.length === 0) return data;
  if (data.length % 16 !== 0) throw new Error("암호 블록이 올바르지 않아요");
  const aes = new aesjs.ModeOfOperation.cbc(key, iv);
  return Uint8Array.from(aes.decrypt(data));
}

function standardKeyFromPassword(password: string, keySizeBits: number, salt: Uint8Array): Uint8Array {
  const pw = utf16leEncode(password);
  let h = hashBytes("SHA1", salt, pw);
  const block = new Uint8Array(24);
  const view = new DataView(block.buffer);
  for (let i = 0; i < 50000; i += 1) {
    view.setUint32(0, i, true);
    block.set(h, 4);
    h = sha1(block);
  }
  const hfinal = hashBytes("SHA1", h, packU32le(0));
  const buf1 = new Uint8Array(64).fill(0x36);
  const buf2 = new Uint8Array(64).fill(0x5c);
  for (let i = 0; i < 20; i += 1) {
    buf1[i] ^= hfinal[i];
    buf2[i] ^= hfinal[i];
  }
  const x3 = concatBytes(sha1(buf1), sha1(buf2));
  return x3.subarray(0, keySizeBits / 8);
}

function verifyStandardKey(key: Uint8Array, encryptedVerifier: Uint8Array, encryptedVerifierHash: Uint8Array): boolean {
  const verifier = aesEcbDecrypt(encryptedVerifier, key);
  const expected = sha1(verifier);
  const actual = aesEcbDecrypt(encryptedVerifierHash, key).subarray(0, 20);
  return bytesEqual(expected, actual);
}

function decryptStandardPackage(key: Uint8Array, encryptedPackage: Uint8Array): Uint8Array {
  const totalSize = u32le(encryptedPackage, 0);
  const payload = encryptedPackage.subarray(8);
  const decrypted = aesEcbDecrypt(payload, key);
  return decrypted.subarray(0, totalSize);
}

const BLK_KEY = new Uint8Array([0x14, 0x6e, 0x0b, 0xe7, 0xab, 0xac, 0xd0, 0xd6]);
const BLK_VERIFIER_INPUT = new Uint8Array([0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79]);
const BLK_VERIFIER_VALUE = new Uint8Array([0xd7, 0xaa, 0x0f, 0x6d, 0x30, 0x61, 0x34, 0x4e]);

function readXmlAttr(xml: string, tagRe: RegExp, attr: string): string {
  const tag = xml.match(tagRe)?.[0];
  if (!tag) throw new Error("암호 정보를 읽지 못했어요");
  const match = tag.match(new RegExp(`${attr}\\s*=\\s*"([^"]*)"`));
  if (!match) throw new Error("암호 정보를 읽지 못했어요");
  return match[1];
}

function b64(value: string): Uint8Array {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function iteratedPasswordHash(password: string, salt: Uint8Array, algorithm: HashName, spinCount: number): Uint8Array {
  let h = hashBytes(algorithm, salt, utf16leEncode(password));
  const block = new Uint8Array(4 + h.length);
  const view = new DataView(block.buffer);
  for (let i = 0; i < spinCount; i += 1) {
    view.setUint32(0, i, true);
    block.set(h, 4);
    h = hashBytes(algorithm, block);
  }
  return h;
}

function agileKey(hash: Uint8Array, blockKey: Uint8Array, algorithm: HashName, keyBits: number): Uint8Array {
  return hashBytes(algorithm, hash, blockKey).subarray(0, keyBits / 8);
}

function decryptAgilePackage(secretKey: Uint8Array, salt: Uint8Array, algorithm: HashName, encryptedPackage: Uint8Array): Uint8Array {
  const view = new DataView(encryptedPackage.buffer, encryptedPackage.byteOffset, encryptedPackage.byteLength);
  const totalSize = Number(view.getBigUint64(0, true));
  const out = new Uint8Array(totalSize);
  let written = 0;
  let index = 0;
  let offset = 8;
  while (written < totalSize && offset < encryptedPackage.length) {
    const end = Math.min(offset + 4096, encryptedPackage.length);
    const chunk = encryptedPackage.subarray(offset, end);
    const padded = chunk.length % 16 === 0 ? chunk : concatBytes(chunk, new Uint8Array(16 - (chunk.length % 16)));
    const iv = hashBytes(algorithm, salt, packU32le(index)).subarray(0, 16);
    const decrypted = aesCbcDecrypt(padded, secretKey, iv);
    const take = Math.min(decrypted.length, totalSize - written);
    out.set(decrypted.subarray(0, take), written);
    written += take;
    offset = end;
    index += 1;
  }
  return out;
}

export function isEncryptedOffice(buffer: ArrayBuffer | Uint8Array): boolean {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 8) return false;
  if (bytes[0] !== 0xd0 || bytes[1] !== 0xcf || bytes[2] !== 0x11 || bytes[3] !== 0xe0) return false;
  try {
    const cfb = CFB.read(bytes, { type: "array" });
    return Boolean(CFB.find(cfb, "EncryptionInfo") && CFB.find(cfb, "EncryptedPackage"));
  } catch {
    return false;
  }
}

export function decryptOfficeWorkbook(buffer: ArrayBuffer | Uint8Array, password: string): Uint8Array {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const cfb = CFB.read(bytes, { type: "array" });
  const infoEntry = CFB.find(cfb, "EncryptionInfo");
  const packageEntry = CFB.find(cfb, "EncryptedPackage");
  if (!infoEntry || !packageEntry) throw new Error("암호가 걸린 엑셀을 열지 못했어요");

  const info = asBytes(infoEntry.content);
  const encryptedPackage = asBytes(packageEntry.content);
  if (info.length < 8) throw new Error("암호가 걸린 엑셀을 열지 못했어요");

  const major = u16le(info, 0);
  const minor = u16le(info, 2);
  let decrypted: Uint8Array;

  if (major === 4 && minor === 4) {
    const xml = new TextDecoder("utf-8").decode(info.subarray(8));
    const keyTag = /<(?:[A-Za-z0-9_-]+:)?encryptedKey\s[^>]*\/?>/;
    const spinCount = Number(readXmlAttr(xml, keyTag, "spinCount"));
    const keyBits = Number(readXmlAttr(xml, keyTag, "keyBits"));
    const passwordSalt = b64(readXmlAttr(xml, keyTag, "saltValue"));
    const algorithm = normalizeHash(readXmlAttr(xml, keyTag, "hashAlgorithm"));
    const encryptedKeyValue = b64(readXmlAttr(xml, keyTag, "encryptedKeyValue"));
    const encryptedVerifierHashInput = b64(readXmlAttr(xml, keyTag, "encryptedVerifierHashInput"));
    const encryptedVerifierHashValue = b64(readXmlAttr(xml, keyTag, "encryptedVerifierHashValue"));
    const keyDataSalt = b64(readXmlAttr(xml, /<keyData\s[^>]*\/?>/, "saltValue"));
    const keyDataHash = normalizeHash(readXmlAttr(xml, /<keyData\s[^>]*\/?>/, "hashAlgorithm"));

    const iterated = iteratedPasswordHash(password, passwordSalt, algorithm, spinCount);
    const verifierInputKey = agileKey(iterated, BLK_VERIFIER_INPUT, algorithm, keyBits);
    const verifierValueKey = agileKey(iterated, BLK_VERIFIER_VALUE, algorithm, keyBits);
    const hashInput = aesCbcDecrypt(encryptedVerifierHashInput, verifierInputKey, passwordSalt);
    const expected = hashBytes(algorithm, hashInput);
    const actual = aesCbcDecrypt(encryptedVerifierHashValue, verifierValueKey, passwordSalt).subarray(0, hashSize(algorithm));
    if (!bytesEqual(expected, actual)) throw new WrongPasswordError();

    const secretKey = aesCbcDecrypt(encryptedKeyValue, agileKey(iterated, BLK_KEY, algorithm, keyBits), passwordSalt);
    decrypted = decryptAgilePackage(secretKey, keyDataSalt, keyDataHash, encryptedPackage);
  } else if ((major === 2 || major === 3 || major === 4) && minor === 2) {
    const headerSize = u32le(info, 8);
    const header = info.subarray(12, 12 + headerSize);
    const algId = u32le(header, 8);
    const keySize = u32le(header, 16) || 128;
    if (algId !== 0x660e && algId !== 0x660f && algId !== 0x6610) {
      throw new Error("이 엑셀 암호 방식은 아직 열 수 없어요");
    }
    const verifier = info.subarray(12 + headerSize);
    const salt = verifier.subarray(4, 20);
    const encryptedVerifier = verifier.subarray(20, 36);
    const encryptedVerifierHash = verifier.subarray(40, 72);
    const key = standardKeyFromPassword(password, keySize, salt);
    if (!verifyStandardKey(key, encryptedVerifier, encryptedVerifierHash)) throw new WrongPasswordError();
    decrypted = decryptStandardPackage(key, encryptedPackage);
  } else {
    throw new Error("이 엑셀 암호 방식은 아직 열 수 없어요");
  }

  if (!isZip(decrypted)) throw new WrongPasswordError();
  return decrypted;
}
