import { chromium } from "playwright";
import { mkdirSync } from "fs";

mkdirSync("screenshots", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(12000);

await page.addInitScript(() => localStorage.removeItem("clubnote-db-v3"));

await page.goto("http://localhost:3000/members", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.screenshot({ path: "screenshots/members.png" });

const hasCategoryTab = await page.locator("button").filter({ hasText: /^기악$/ }).count();
const hasGroupTab = await page.locator("button").filter({ hasText: /^그룹1$/ }).count();
const hasAttendRate = await page.getByRole("columnheader", { name: "참석률" }).count();
const hasParticipation = await page.getByRole("columnheader", { name: "참여도" }).count();
const osehun = page.locator("tr", { hasText: "오세훈" }).first();
const osehunText = await osehun.innerText();

await page.getByRole("button", { name: "회원 추가" }).click();
await page.getByRole("dialog", { name: "회원 추가" }).getByPlaceholder("이름").fill("테스트회원");
await page.getByRole("dialog", { name: "회원 추가" }).getByRole("button", { name: "회원 추가" }).click();
await page.waitForTimeout(400);
const added = await page.getByText("테스트회원").count();

await page.goto("http://localhost:3000/attendance", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.screenshot({ path: "screenshots/attendance.png" });
const osehunInTue = await page.getByText("오세훈").count();

await page.goto("http://localhost:3000/calendar", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.screenshot({ path: "screenshots/calendar.png" });
const notice = await page.getByText("연습 일정 공지").count();
const may2Selected = await page.locator("text=5월 2일").count();

const eventDialog = page.getByRole("dialog", { name: "일정 생성" });
await page.getByRole("button", { name: "일정 생성" }).first().click();
await page.waitForTimeout(200);
await eventDialog.getByRole("button", { name: /^시작 날짜/ }).click();
const datePicker = eventDialog.locator("[data-date-picker]");
await datePicker.waitFor();
for (let i = 0; i < 24; i++) {
  const month = await datePicker.getAttribute("data-month");
  if (month === "2026-09") break;
  if ((month ?? "") < "2026-09") await datePicker.getByRole("button", { name: "다음 달" }).click();
  else await datePicker.getByRole("button", { name: "이전 달" }).click();
}
await eventDialog.getByRole("button", { name: "2026-09-15" }).click();
await eventDialog.getByRole("button", { name: "일정 생성" }).click();
await page.waitForTimeout(500);

await page.goto("http://localhost:3000/attendance", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const sep15 = await page.getByText("9월 15일").count();

console.log(
  JSON.stringify(
    {
      hasCategoryTab,
      hasGroupTab,
      hasAttendRate,
      hasParticipation,
      osehunText: osehunText.replace(/\s+/g, " ").slice(0, 180),
      added,
      osehunInTue,
      notice,
      may2Selected,
      sep15,
    },
    null,
    2,
  ),
);

await browser.close();
