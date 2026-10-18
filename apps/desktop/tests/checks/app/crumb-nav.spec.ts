// app/crumb-nav · his ask: the titlebar's crumb walks him back, like a path (designer's
// desktop-history's third way besides ‹ and esc). The NEW app on the scripted core (FakeCore's
// fixture world: acme's row, perf and docs at work), one launch per route. Passes when:
//   - on an agent's thread, the project's name is a real button that opens that project's main
//     thread, as a history step (‹ goes back to the agent);
//   - on a review, the project's name → the project's main, the agent's name → its thread, the
//     'changes' word (where he is) stays plain; both are keyboard reachable (focus, ⏎);
//   - on the agents list, the project's name goes to its main, its own word stays plain (the last);
//   - a project's main has one crumb and no button in it; an earlier crumb changes on hover.
// Owner: amb-win (crumbGoOf's unit cover is in src/app/side.test.ts).
import { FakeCore, launchDesktop, test, expect } from '../../harness';

const P = 'acme-1a2b3c4d';

const T = {
  thread: '[data-testid="thread.screen"]',
  field: '[data-testid="composer.field"]',
  crumb: '[data-testid="app.title.crumb"]',
  go: (n: number) => `[data-testid="app.title.crumb.${String(n)}"]`,
  anyGo: '[data-testid^="app.title.crumb."]',
  back: '[data-testid="app.title.back"]',
  review: '[data-testid="review.screen"]',
  agents: '[data-testid="agents.screen"]',
};

test("app/crumb-nav: an agent's thread — the project's name opens its main, as a history step", async () => {
  test.setTimeout(60_000);
  const core = new FakeCore();
  const s = await launchDesktop({ core, route: `agent/${P}/perf` });
  try {
    const { page } = s;
    await expect(page.locator(T.field).first(), "perf's thread").toBeVisible({ timeout: 10_000 });
    await expect(page.locator(T.go(0)), "the project's name is the button").toHaveText('acme');
    await expect(page.locator(T.crumb), 'the words never change').toHaveText('acme›perf');
    await page.locator(T.go(0)).click();
    await expect(page.locator(T.thread).first(), "the project's main thread").toHaveAttribute('data-agent', 'main', { timeout: 5000 });
    await expect(page.locator(T.back), 'a history step, ‹ goes back').toBeEnabled();
    await page.locator(T.back).click();
    await expect(page.locator(T.thread).first(), 'back at perf').toHaveAttribute('data-agent', 'perf', { timeout: 5000 });
  } finally {
    await s.close();
    core.dispose();
  }
});

test("app/crumb-nav: a review — the project's name → its main, the agent's name → its thread, the word stays plain", async () => {
  test.setTimeout(60_000);
  const core = new FakeCore();
  const s = await launchDesktop({ core, route: `review/${P}/perf` });
  try {
    const { page } = s;
    const atMain = () =>
      expect(page.locator(T.thread).first(), "the project's main thread").toHaveAttribute('data-agent', 'main', { timeout: 5000 });
    await expect(page.locator(T.review), 'the review screen').toBeVisible({ timeout: 10_000 });
    await expect(page.locator(T.crumb), 'three crumbs').toHaveText('acme›perf›changes');
    // the keyboard: the project's name takes focus, ⏎ goes there
    await page.locator(T.go(0)).focus();
    await page.keyboard.press('Enter');
    await atMain();
    await page.locator(T.back).click();
    await expect(page.locator(T.review), 'back at the review').toBeVisible({ timeout: 5000 });
    // the agent's name (a button) opens its thread; the 'changes' word is where he is, no button
    await expect(page.locator(T.go(1)), "the agent's name is a button").toHaveText('perf');
    await page.locator(T.go(1)).click();
    await expect(page.locator(T.thread).first(), "perf's thread").toHaveAttribute('data-agent', 'perf', { timeout: 5000 });
    await page.locator(T.back).click();
    await expect(page.locator(T.review)).toBeVisible({ timeout: 5000 });
    await expect(page.locator(T.go(2)), 'the last crumb is where he is, never a button').toHaveCount(0);
  } finally {
    await s.close();
    core.dispose();
  }
});

test("app/crumb-nav: the agents list — the project's name goes to its main, its own word stays plain", async () => {
  test.setTimeout(60_000);
  const core = new FakeCore();
  const s = await launchDesktop({ core, route: `agents/${P}` });
  try {
    const { page } = s;
    await expect(page.locator(T.agents), 'the agents list').toBeVisible({ timeout: 10_000 });
    await expect(page.locator(T.crumb)).toHaveText('acme›agents');
    await expect(page.locator(T.go(1)), 'the word is the last: no button').toHaveCount(0);
    await page.locator(T.go(0)).click();
    await expect(page.locator(T.thread).first(), "the project's main thread").toHaveAttribute('data-agent', 'main', { timeout: 5000 });
  } finally {
    await s.close();
    core.dispose();
  }
});

test("app/crumb-nav: a project's main — one crumb, no button in it; an earlier crumb changes on hover", async () => {
  test.setTimeout(60_000);
  const core = new FakeCore();
  const s = await launchDesktop({ core, route: `agent/${P}/perf` });
  try {
    const { page } = s;
    await expect(page.locator(T.field).first()).toBeVisible({ timeout: 10_000 });
    // a hover: the earlier name lights, as the other controls do (app/clicks' audit)
    const look = () =>
      page.locator(T.go(0)).evaluate((el) => {
        const c = getComputedStyle(el);
        return [c.color, c.textDecorationLine, c.backgroundColor].join('|');
      });
    await page.mouse.move(1, 1);
    await page.waitForTimeout(60);
    const before = await look();
    const box = await page.locator(T.go(0)).boundingBox();
    expect(box, 'the crumb is on screen').not.toBeNull();
    if (box !== null) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(160);
    expect(await look(), 'the earlier crumb changes on hover').not.toBe(before);
    // then to the main: one crumb, nothing to go
    await page.locator(T.go(0)).click();
    await expect(page.locator(T.thread).first()).toHaveAttribute('data-agent', 'main', { timeout: 5000 });
    await expect(page.locator(T.crumb), "the project's name alone").toHaveText('acme');
    await expect(page.locator(T.anyGo), 'no button in it').toHaveCount(0);
  } finally {
    await s.close();
    core.dispose();
  }
});
