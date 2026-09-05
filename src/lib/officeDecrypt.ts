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
  return Uint8Array.from(content);
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

function isOle(bytes: Uint8Array): boolean {
  return bytes.length >= 8 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
}

function looksLikeWorkbook(bytes: Uint8Array): boolean {
  return isZip(bytes) || isOle(bytes);
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

function aesKey(key: Uint8Array): number[] {
  return Array.from(key);
}

function aesEcbDecrypt(data: Uint8Array, key: Uint8Array): Uint8Array {
  if (data.length === 0) return data;
  if (data.length % 16 !== 0) throw new Error("암호 블록이 올바르지 않아요");
  const aes = new aesjs.ModeOfOperation.ecb(aesKey(key));
  return Uint8Array.from(aes.decrypt(Array.from(data)));
}

function aesCbcDecrypt(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
  if (data.length === 0) return data;
  if (data.length % 16 !== 0) throw new Error("암호 블록이 올바르지 않아요");
  const aes = new aesjs.ModeOfOperation.cbc(aesKey(key), Array.from(iv));
  return Uint8Array.from(aes.decrypt(Array.from(data)));
}

function blockAlign(data: Uint8Array): Uint8Array {
  const rem = data.length % 16;
  if (rem === 0) return data;
  return concatBytes(data, new Uint8Array(16 - rem));
}

function pkcs7Unpad(data: Uint8Array): Uint8Array {
  if (data.length === 0) return data;
  const pad = data[data.length - 1];
  if (pad < 1 || pad > 16 || pad > data.length) return data;
  for (let i = data.length - pad; i < data.length; i += 1) {
    if (data[i] !== pad) return data;
  }
  return data.subarray(0, data.length - pad);
}

function truncateHash(hash: Uint8Array, size: number): Uint8Array {
  if (hash.length >= size) return Uint8Array.from(hash.subarray(0, size));
  const out = new Uint8Array(size).fill(0x36);
  out.set(hash);
  return out;
}

function cryptDeriveKey(hfinal: Uint8Array, keyBytes: number): Uint8Array {
  const buf1 = new Uint8Array(64).fill(0x36);
  const buf2 = new Uint8Array(64).fill(0x5c);
  const n = Math.min(hfinal.length, 64);
  for (let i = 0; i < n; i += 1) {
    buf1[i] ^= hfinal[i];
    buf2[i] ^= hfinal[i];
  }
  return concatBytes(sha1(buf1), sha1(buf2)).subarray(0, keyBytes);
}

function iteratedSha1(passwordBytes: Uint8Array, salt: Uint8Array, iteratorFirst: boolean): Uint8Array {
  let h = sha1(concatBytes(salt, passwordBytes));
  const block = new Uint8Array(24);
  const view = new DataView(block.buffer);
  for (let i = 0; i < 50000; i += 1) {
    if (iteratorFirst) {
      view.setUint32(0, i, true);
      block.set(h, 4);
    } else {
      block.set(h, 0);
      view.setUint32(20, i, true);
    }
    h = sha1(block);
  }
  return h;
}

function uniqueKeys(keys: Uint8Array[]): Uint8Array[] {
  const seen = new Set<string>();
  const out: Uint8Array[] = [];
  for (const key of keys) {
    const id = Array.from(key).join(",");
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(Uint8Array.from(key));
  }
  return out;
}

function keysFromHn(hn: Uint8Array, keyBytes: number): Uint8Array[] {
  const hfinal = sha1(concatBytes(hn, packU32le(0)));
  return uniqueKeys([cryptDeriveKey(hfinal, keyBytes), truncateHash(hfinal, keyBytes), cryptDeriveKey(hn, keyBytes), truncateHash(hn, keyBytes)]);
}

function passwordEncodings(password: string): Uint8Array[] {
  const nfc = password.normalize("NFC");
  const nfd = password.normalize("NFD");
  const encodings = [utf16leEncode(nfc)];
  if (nfd !== nfc) encodings.push(utf16leEncode(nfd));
  encodings.push(concatBytes(utf16leEncode(nfc), new Uint8Array(2)));
  encodings.push(new TextEncoder().encode(nfc));
  if (nfc.length > 15) encodings.push(utf16leEncode(nfc.slice(0, 15)));
  return encodings;
}

function aesBlocks(data: Uint8Array): Uint8Array {
  const n = data.length - (data.length % 16);
  return n > 0 ? data.subarray(0, n) : data;
}

function verifyStandardKey(key: Uint8Array, encryptedVerifier: Uint8Array, encryptedVerifierHash: Uint8Array): boolean {
  const verifier = aesEcbDecrypt(aesBlocks(encryptedVerifier), key);
  const actual = aesEcbDecrypt(aesBlocks(encryptedVerifierHash), key).subarray(0, 20);
  const candidates = [verifier, pkcs7Unpad(verifier)];
  for (const candidate of candidates) {
    if (bytesEqual(sha1(candidate), actual)) return true;
  }
  return false;
}

function decryptSegmentedCbc(payload: Uint8Array, key: Uint8Array, salt: Uint8Array, totalSize: number, segment: number): Uint8Array {
  const out = new Uint8Array(totalSize);
  let written = 0;
  let index = 0;
  let offset = 0;
  const aligned = blockAlign(payload);
  while (written < totalSize && offset < aligned.length) {
    const end = Math.min(offset + segment, aligned.length);
    const chunk = blockAlign(aligned.subarray(offset, end));
    const iv = sha1(concatBytes(salt, packU32le(index))).subarray(0, 16);
    const decrypted = aesCbcDecrypt(chunk, key, iv);
    const take = Math.min(decrypted.length, totalSize - written);
    out.set(decrypted.subarray(0, take), written);
    written += take;
    offset = end;
    index += 1;
  }
  return out;
}

function decryptStandardPackageCandidates(key: Uint8Array, encryptedPackage: Uint8Array, salt: Uint8Array): Uint8Array[] {
  const totalSize = u32le(encryptedPackage, 0);
  if (totalSize <= 0 || totalSize > encryptedPackage.length * 2) return [];
  const payload = blockAlign(encryptedPackage.subarray(8));
  const out: Uint8Array[] = [];
  try {
    out.push(aesEcbDecrypt(payload, key).subarray(0, totalSize));
  } catch {
    /* ignore */
  }
  try {
    out.push(decryptSegmentedCbc(payload, key, salt, totalSize, 4096));
  } catch {
    /* ignore */
  }
  try {
    out.push(aesCbcDecrypt(payload, key, salt).subarray(0, totalSize));
  } catch {
    /* ignore */
  }
  try {
    out.push(aesCbcDecrypt(payload, key, new Uint8Array(16)).subarray(0, totalSize));
  } catch {
    /* ignore */
  }
  return out;
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

function iteratedPasswordHash(passwordBytes: Uint8Array, salt: Uint8Array, algorithm: HashName, spinCount: number): Uint8Array {
  let h = hashBytes(algorithm, salt, passwordBytes);
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
  return truncateHash(hashBytes(algorithm, hash, blockKey), keyBits / 8);
}

function decryptAgilePackage(secretKey: Uint8Array, salt: Uint8Array, algorithm: HashName, encryptedPackage: Uint8Array): Uint8Array {
  const view = new DataView(encryptedPackage.buffer, encryptedPackage.byteOffset, encryptedPackage.byteLength);
  const totalSize = Number(view.getBigUint64(0, true));
  if (!Number.isFinite(totalSize) || totalSize <= 0 || totalSize > encryptedPackage.length * 2) {
    throw new Error("암호가 걸린 엑셀을 열지 못했어요");
  }
  const out = new Uint8Array(totalSize);
  let written = 0;
  let index = 0;
  let offset = 8;
  while (written < totalSize && offset < encryptedPackage.length) {
    const end = Math.min(offset + 4096, encryptedPackage.length);
    const chunk = encryptedPackage.subarray(offset, end);
    const padded = blockAlign(chunk);
    const iv = truncateHash(hashBytes(algorithm, salt, packU32le(index)), 16);
    const decrypted = aesCbcDecrypt(padded, secretKey, iv);
    const take = Math.min(decrypted.length, totalSize - written);
    out.set(decrypted.subarray(0, take), written);
    written += take;
    offset = end;
    index += 1;
  }
  return out;
}

function agileVerifierMatches(
  iterated: Uint8Array,
  algorithm: HashName,
  keyBits: number,
  passwordSalt: Uint8Array,
  encryptedVerifierHashInput: Uint8Array,
  encryptedVerifierHashValue: Uint8Array,
): boolean {
  const verifierInputKey = agileKey(iterated, BLK_VERIFIER_INPUT, algorithm, keyBits);
  const verifierValueKey = agileKey(iterated, BLK_VERIFIER_VALUE, algorithm, keyBits);
  const hashInput = aesCbcDecrypt(encryptedVerifierHashInput, verifierInputKey, passwordSalt);
  const actual = aesCbcDecrypt(encryptedVerifierHashValue, verifierValueKey, passwordSalt).subarray(0, hashSize(algorithm));
  const inputs = [hashInput, pkcs7Unpad(hashInput), hashInput.subarray(0, Math.min(passwordSalt.length, hashInput.length))];
  for (const input of inputs) {
    if (bytesEqual(hashBytes(algorithm, input), actual)) return true;
  }
  return false;
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

function decryptStandardWorkbook(info: Uint8Array, encryptedPackage: Uint8Array, password: string): Uint8Array {
  const headerSize = u32le(info, 8);
  const header = info.subarray(12, 12 + headerSize);
  const algId = u32le(header, 8);
  const keySize = u32le(header, 16) || 128;
  if (algId !== 0x660e && algId !== 0x660f && algId !== 0x6610) {
    throw new Error("이 엑셀 암호 방식은 아직 열 수 없어요");
  }
  const verifier = info.subarray(12 + headerSize);
  const saltSize = u32le(verifier, 0) || 16;
  const salt = verifier.subarray(4, 4 + saltSize);
  const encryptedVerifier = verifier.subarray(4 + saltSize, 4 + saltSize + 16);
  const encryptedVerifierHash = verifier.subarray(4 + saltSize + 20);
  const keyBytes = keySize / 8;
  let verified = false;

  for (const encoding of passwordEncodings(password)) {
    for (const iteratorFirst of [true, false]) {
      const hn = iteratedSha1(encoding, salt, iteratorFirst);
      const keys = keysFromHn(hn, keyBytes);
      const matching = keys.filter((key) => verifyStandardKey(key, encryptedVerifier, encryptedVerifierHash));
      const tryKeys = matching.length > 0 ? matching : keys;
      if (matching.length > 0) verified = true;
      for (const key of tryKeys) {
        for (const candidate of decryptStandardPackageCandidates(key, encryptedPackage, salt)) {
          if (looksLikeWorkbook(candidate)) return candidate;
        }
      }
      if (matching.length > 0) break;
    }
  }

  if (verified) throw new Error("암호가 걸린 엑셀을 열지 못했어요");
  throw new WrongPasswordError();
}

function decryptAgileWorkbook(info: Uint8Array, encryptedPackage: Uint8Array, password: string): Uint8Array {
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
  let verified = false;

  for (const encoding of passwordEncodings(password)) {
    const iterated = iteratedPasswordHash(encoding, passwordSalt, algorithm, spinCount);
    if (agileVerifierMatches(iterated, algorithm, keyBits, passwordSalt, encryptedVerifierHashInput, encryptedVerifierHashValue)) {
      verified = true;
    }
    const secret = aesCbcDecrypt(encryptedKeyValue, agileKey(iterated, BLK_KEY, algorithm, keyBits), passwordSalt);
    const secretKeys = uniqueKeys([truncateHash(secret, keyBits / 8), truncateHash(pkcs7Unpad(secret), keyBits / 8)]);
    for (const secretKey of secretKeys) {
      try {
        const decrypted = decryptAgilePackage(secretKey, keyDataSalt, keyDataHash, encryptedPackage);
        if (looksLikeWorkbook(decrypted)) return decrypted;
      } catch {
        /* try next */
      }
    }
    if (verified) break;
  }

  if (verified) throw new Error("암호가 걸린 엑셀을 열지 못했어요");
  throw new WrongPasswordError();
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

  if (major === 4 && minor === 4) return decryptAgileWorkbook(info, encryptedPackage, password);
  if ((major === 2 || major === 3 || major === 4) && minor === 2) {
    return decryptStandardWorkbook(info, encryptedPackage, password);
  }
  throw new Error("이 엑셀 암호 방식은 아직 열 수 없어요");
}
