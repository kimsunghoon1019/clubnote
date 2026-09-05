import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as CFB from "cfb";
import * as XLSX from "xlsx";
import { parseBankExcelFile } from "../src/lib/bankExcel.ts";
import { decryptOfficeWorkbook, isEncryptedOffice, WrongPasswordError } from "../src/lib/officeDecrypt.ts";

const root = dirname(fileURLToPath(import.meta.url));
const outDir = join(root, "..", "tmp");

function sha1(...parts: Buffer[]): Buffer {
  const hash = createHash("sha1");
  for (const part of parts) hash.update(part);
  return hash.digest();
}

function hashedPassword(password: string, salt: Buffer): { hn: Buffer; hfinal: Buffer } {
  let h = sha1(Buffer.concat([salt, Buffer.from(password, "utf16le")]));
  for (let i = 0; i < 50000; i += 1) {
    const iter = Buffer.alloc(4);
    iter.writeUInt32LE(i);
    h = sha1(Buffer.concat([iter, h]));
  }
  const block = Buffer.alloc(4);
  return { hn: h, hfinal: sha1(Buffer.concat([h, block])) };
}

function cryptDeriveKey(hfinal: Buffer): Buffer {
  const buf1 = Buffer.alloc(64, 0x36);
  const buf2 = Buffer.alloc(64, 0x5c);
  for (let i = 0; i < 20; i += 1) {
    buf1[i] ^= hfinal[i];
    buf2[i] ^= hfinal[i];
  }
  return Buffer.concat([sha1(buf1), sha1(buf2)]).subarray(0, 16);
}

function standardKey(password: string, salt: Buffer): Buffer {
  return cryptDeriveKey(hashedPassword(password, salt).hfinal);
}

function truncateKey(password: string, salt: Buffer): Buffer {
  return hashedPassword(password, salt).hfinal.subarray(0, 16);
}

function aesEcbEncrypt(data: Buffer, key: Buffer): Buffer {
  const cipher = createCipheriv("aes-128-ecb", key, null);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(data), cipher.final()]);
}

function u32(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(value);
  return buf;
}

function u16(value: number): Buffer {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(value);
  return buf;
}

function makeBankXlsx(): Buffer {
  const rows = [
    ["거래일시", "거래유형", "적요", "거래금액", "거래후잔액", "거래기관", "계좌번호", "메모"],
    ["2026-08-03 09:12:00", "입금", "비밀번호테스트입금", 15000, 735452, "토스뱅크", "1002-****-3803", ""],
    ["2026-08-01 09:00:11", "입금", "비밀번호테스트이자", 12, 720452, "토스뱅크", "1002-****-3803", ""],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "거래내역");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function encryptStandard(xlsx: Buffer, password: string, keyFn = standardKey): Buffer {
  const salt = randomBytes(16);
  const key = keyFn(password, salt);
  const verifier = randomBytes(16);
  const verifierHash = Buffer.concat([sha1(verifier), Buffer.alloc(12)]);
  const csp = Buffer.from("Microsoft Enhanced RSA and AES Cryptographic Provider\0", "utf16le");
  const header = Buffer.concat([
    u32(0x24),
    u32(0),
    u32(0x660e),
    u32(0x8004),
    u32(128),
    u32(0x18),
    u32(0),
    u32(0),
    csp,
  ]);
  const info = Buffer.concat([
    u16(4),
    u16(2),
    u32(0x24),
    u32(header.length),
    header,
    u32(16),
    salt,
    aesEcbEncrypt(verifier, key),
    u32(20),
    aesEcbEncrypt(verifierHash, key),
  ]);
  const pad = (16 - (xlsx.length % 16)) % 16;
  const payload = Buffer.concat([xlsx, Buffer.alloc(pad)]);
  const pkg = Buffer.concat([Buffer.alloc(8), aesEcbEncrypt(payload, key)]);
  pkg.writeUInt32LE(xlsx.length, 0);

  let cfb = CFB.utils.cfb_new();
  CFB.utils.cfb_add(cfb, "EncryptionInfo", info);
  CFB.utils.cfb_add(cfb, "EncryptedPackage", pkg);
  CFB.utils.cfb_del(cfb, "\u0001Sh33tJ5");
  return Buffer.from(CFB.write(cfb, { type: "buffer" }));
}

async function main() {
  const vectorSalt = Buffer.from("e88266490c5bd1eebd2b4394e3f830ef", "hex");
  const nodeKey = standardKey("Password1234_", vectorSalt);
  const expected = Buffer.from("40b13a71f90b966e375408f2d181a1aa", "hex");
  if (!nodeKey.equals(expected)) throw new Error(`node key vector mismatch ${nodeKey.toString("hex")}`);

  const password = "clubnote";
  const xlsx = makeBankXlsx();
  const encrypted = encryptStandard(xlsx, password);
  writeFileSync(join(outDir, "bank-password.xlsx"), encrypted);

  if (!isEncryptedOffice(encrypted)) throw new Error("encrypted file not detected");

  let wrong = false;
  try {
    decryptOfficeWorkbook(encrypted, "wrong-password");
  } catch (error) {
    wrong = error instanceof WrongPasswordError;
  }
  if (!wrong) throw new Error("wrong password was accepted");

  const decrypted = decryptOfficeWorkbook(encrypted, password);
  if (decrypted[0] !== 0x50 || decrypted[1] !== 0x4b) throw new Error("decrypted bytes are not xlsx");

  const file = new File([new Uint8Array(encrypted)], "토스뱅크_거래내역.xlsx");
  const needs = await parseBankExcelFile(file);
  if (!needs.needsPassword) throw new Error("password prompt not requested");

  const parsed = await parseBankExcelFile(file, password);
  if (parsed.error) throw new Error(parsed.error);
  if (parsed.rows.length !== 2) throw new Error(`expected 2 rows, got ${parsed.rows.length}`);
  if (parsed.rows[0].title !== "비밀번호테스트입금") throw new Error(parsed.rows[0].title);

  const truncated = encryptStandard(xlsx, password, truncateKey);
  writeFileSync(join(outDir, "bank-password-truncate.xlsx"), truncated);
  const truncatedParsed = await parseBankExcelFile(new File([new Uint8Array(truncated)], "토스뱅크_거래내역.xlsx"), password);
  if (truncatedParsed.error) throw new Error(`truncate: ${truncatedParsed.error}`);
  if (truncatedParsed.rows.length !== 2) throw new Error(`truncate expected 2 rows, got ${truncatedParsed.rows.length}`);

  const agilePath = join(outDir, "bank-agile.xlsx");
  if (existsSync(agilePath)) {
    const agile = readFileSync(agilePath);
    if (!isEncryptedOffice(agile)) throw new Error("agile file not detected");
    const agileDecrypted = decryptOfficeWorkbook(agile, password);
    if (agileDecrypted[0] !== 0x50 || agileDecrypted[1] !== 0x4b) throw new Error("agile decrypted bytes are not xlsx");
    const agileParsed = await parseBankExcelFile(new File([new Uint8Array(agile)], "토스뱅크_거래내역.xlsx"), password);
    if (agileParsed.error) throw new Error(agileParsed.error);
    if (agileParsed.rows.length !== 2) throw new Error(`agile expected 2 rows, got ${agileParsed.rows.length}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        rows: parsed.rows.map((row) => ({ title: row.title, amount: row.amount, occurredOn: row.occurredOn })),
        encryptedBytes: encrypted.length,
      },
      null,
      2,
    ),
  );
}

await main();
