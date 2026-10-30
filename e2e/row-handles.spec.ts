import { expect, test, type Locator, type Page } from "@playwright/test";

async function openGame(page: Page): Promise<void> {
	await page.addInitScript(() => {
		try {
			localStorage.setItem("rref.tutorialSeen", "1");
		} catch {
			// ignore blocked storage
		}
	});
	await page.goto("/");
	await expect(page.locator(".row-handle")).toHaveCount(2);
}

function handle(page: Page, rowId: number): Locator {
	return page.locator(`.row-handle[data-row="${rowId}"]`);
}

async function dragHandle(page: Page, rowId: number, distanceY: number): Promise<void> {
	const box = await handle(page, rowId).boundingBox();
	if (!box) throw new Error("row handle is not visible");
	const x = box.x + box.width / 2;
	const y = box.y + box.height / 2;
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(x, y + distanceY, { steps: 5 });
	await page.mouse.up();
	await page.waitForTimeout(180);
}

test.describe("row drag handles", () => {
	test("keeps only Undo, Hint, and Restart in the toolbar", async ({ page }) => {
		await openGame(page);
		await expect(page.locator("#toolbar button")).toHaveCount(3);
		await expect(page.locator("#btn-undo")).toBeVisible();
		await expect(page.locator("#btn-hint")).toBeVisible();
		await expect(page.locator("#btn-restart")).toBeVisible();
		await expect(page.locator("#btn-lift")).toHaveCount(0);
		await expect(page.locator("#btn-swap-up")).toHaveCount(0);
		await expect(page.locator("#btn-swap-down")).toHaveCount(0);
		await expect(page.locator("#help-line")).toHaveCount(0);
	});

	test("sits to the right of each row and hides while a row is lifted", async ({ page }) => {
		await openGame(page);

		const board = await page.locator("#board").boundingBox();
		const first = await handle(page, 0).boundingBox();
		expect(board).not.toBeNull();
		expect(first).not.toBeNull();
		expect(first!.x).toBeGreaterThanOrEqual(board!.x + board!.width);
		expect(first!.width).toBeGreaterThanOrEqual(44);

		await page.keyboard.press("ArrowRight");
		await expect(handle(page, 0)).toBeHidden();
		await expect(handle(page, 1)).toBeHidden();

		await page.keyboard.press("Escape");
		await expect(handle(page, 0)).toBeVisible();
		await expect(handle(page, 1)).toBeVisible();
	});

	test("dragging a handle swaps that row with its neighbor", async ({ page }) => {
		await openGame(page);
		const first = await handle(page, 0).boundingBox();
		const second = await handle(page, 1).boundingBox();
		expect(first).not.toBeNull();
		expect(second).not.toBeNull();
		const step = second!.y - first!.y;

		await dragHandle(page, 0, step);

		await expect(handle(page, 0)).toHaveAttribute("data-pos", "1");
		await expect(handle(page, 1)).toHaveAttribute("data-pos", "0");
		await expect(page.locator('[data-stat="moves"]')).toHaveText("1");
	});

	test("groups a sequence of swaps of the same row into one move", async ({ page }) => {
		await openGame(page);
		const first = await handle(page, 0).boundingBox();
		const second = await handle(page, 1).boundingBox();
		expect(first).not.toBeNull();
		expect(second).not.toBeNull();
		const step = second!.y - first!.y;

		await dragHandle(page, 0, step);
		await expect(page.locator('[data-stat="moves"]')).toHaveText("1");
		await dragHandle(page, 0, -step);
		await expect(page.locator('[data-stat="moves"]')).toHaveText("1");
		await expect(handle(page, 0)).toHaveAttribute("data-pos", "0");

		await page.keyboard.press("u");
		await expect(page.locator('[data-stat="moves"]')).toHaveText("0");
		await expect(handle(page, 0)).toHaveAttribute("data-pos", "0");
	});
});
