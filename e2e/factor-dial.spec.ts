import { expect, test, type Locator, type Page } from "@playwright/test";

function drawer(page: Page, side: "left" | "right"): Locator {
	return page.locator(side === "left" ? "#scale-dial" : "#lift-dial");
}

function numerator(page: Page, side: "left" | "right" = "left"): Locator {
	return drawer(page, side).locator('number-dial[data-dial="numerator"]');
}

function denominator(page: Page, side: "left" | "right" = "left"): Locator {
	return drawer(page, side).locator('number-dial[data-dial="denominator"]');
}

async function openGame(page: Page): Promise<void> {
	await page.addInitScript(() => {
		try {
			localStorage.setItem("rref.tutorialSeen", "1");
		} catch {
			// ignore blocked storage
		}
	});
	await page.goto("/");
	await expect(numerator(page)).toHaveAttribute("data-value", "1");
	await expect(denominator(page)).toHaveAttribute("data-value", "1");
}

async function dragDial(page: Page, dial: Locator, distanceY: number, pause = 40): Promise<void> {
	const box = await dial.boundingBox();
	if (!box) throw new Error("dial is not visible");
	const x = box.x + box.width / 2;
	const y = box.y + box.height / 2;
	await page.mouse.move(x, y);
	await page.mouse.down();
	const steps = 6;
	for (let i = 1; i <= steps; i++) {
		await page.mouse.move(x, y + (distanceY * i) / steps);
		await page.waitForTimeout(pause);
	}
}

test.describe("factor drawers", () => {
	test("opens the left drawer by default and keeps the right drawer closed", async ({ page }) => {
		await openGame(page);

		const left = drawer(page, "left");
		const right = drawer(page, "right");
		await expect(left).toHaveAttribute("open", "");
		await expect(right).not.toHaveAttribute("open");
		await expect(left.locator("number-dial")).toHaveCount(2);
		await expect(right.locator("number-dial")).toHaveCount(2);
		await expect(page.locator(".k-sign")).toHaveCount(0);
		await expect(numerator(page).locator('.dial-item[data-value="0"]')).toHaveCount(0);

		const rightWidth = await right.evaluate(el => el.getBoundingClientRect().width);
		expect(rightWidth).toBe(0);
	});

	test("the left dial immediately scales the selected row", async ({ page }) => {
		await openGame(page);
		const num = numerator(page);

		await num.focus();
		await page.keyboard.press("ArrowUp");
		await expect(num).toHaveAttribute("data-value", "2");

		await expect(page.locator("#hud .mode-label")).toHaveText("Scale row 1 × 2 — left dial applies immediately");
		await expect(page.locator('[data-stat="moves"]')).toHaveText("1");
	});

	test("builds an exact 2/3 factor on the left dial", async ({ page }) => {
		await openGame(page);
		const num = numerator(page);
		const den = denominator(page);

		await num.focus();
		await page.keyboard.press("ArrowUp");
		await expect(num).toHaveAttribute("data-value", "2");

		await den.focus();
		await page.keyboard.press("ArrowUp");
		await expect(den).toHaveAttribute("data-value", "2");
		await page.keyboard.press("ArrowUp");
		await expect(den).toHaveAttribute("data-value", "3");
		await expect(den).toHaveAttribute("aria-valuetext", "1/3");

		await expect(page.locator("#hud .mode-label")).toHaveText("Scale row 1 × 2/3 — left dial applies immediately");
	});

	test("lifting a row swaps to the right drawer and applies its factor", async ({ page }) => {
		await openGame(page);
		const left = drawer(page, "left");
		const right = drawer(page, "right");

		await page.keyboard.press("ArrowRight");
		await expect(left).not.toHaveAttribute("open");
		await expect(right).toHaveAttribute("open", "");
		await expect(numerator(page, "right")).toHaveAttribute("data-value", "1");
		await expect(denominator(page, "right")).toHaveAttribute("data-value", "1");
		await expect(page.locator("#hud .mode-label")).toContainText("Lift row 1 × 1");

		await numerator(page, "right").focus();
		await page.keyboard.press("ArrowUp");
		await expect(numerator(page, "right")).toHaveAttribute("data-value", "2");
		await expect(page.locator("#hud .mode-label")).toContainText("Lift row 1 × 2");

		await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
		await page.keyboard.press("ArrowDown"); // align the lifted copy with row 2
		await page.keyboard.press("Enter");

		await expect(page.locator('[data-stat="moves"]')).toHaveText("1");
		await expect(left).toHaveAttribute("open", "");
		await expect(right).not.toHaveAttribute("open");
	});

	test("reaches negative numerators and denominator endpoints without a sign button", async ({ page }) => {
		await openGame(page);
		const num = numerator(page);
		const den = denominator(page);

		await num.focus();
		await page.keyboard.press("Home");
		await expect(num).toHaveAttribute("data-value", "-20");
		await expect(num).toHaveAttribute("aria-valuetext", "−20");
		await expect(page.locator("#hud .mode-label")).toContainText("Scale row 1 × −20");

		await den.focus();
		await page.keyboard.press("End");
		await expect(den).toHaveAttribute("data-value", "20");
		await expect(den).toHaveAttribute("aria-valuetext", "1/20");

		await page.keyboard.press("Home");
		await expect(den).toHaveAttribute("data-value", "1");
	});

	test("snaps a slow drag to the nearest value", async ({ page }) => {
		await openGame(page);
		const num = numerator(page);

		await dragDial(page, num, -30);
		await page.waitForTimeout(120);
		await page.mouse.up();

		await expect(num).toHaveAttribute("data-value", "2");
	});

	test("a fast flick keeps moving with momentum then settles on a value", async ({ page }) => {
		await openGame(page);
		const num = numerator(page);
		const box = await num.boundingBox();
		if (!box) throw new Error("numerator dial is not visible");
		const x = box.x + box.width / 2;
		const y = box.y + box.height / 2;

		await page.mouse.move(x, y);
		await page.mouse.down();
		for (let i = 1; i <= 4; i++) {
			await page.mouse.move(x, y - i * 40);
			await page.waitForTimeout(8);
		}
		await page.mouse.up();

		await page.waitForTimeout(2_200);

		const value = Number(await num.getAttribute("data-value"));
		expect(Number.isInteger(value)).toBe(true);
		expect(value).toBeGreaterThan(4);
		expect(value).toBeLessThanOrEqual(20);
	});

	test("the open drawer and board fit on a narrow mobile viewport", async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await openGame(page);

		const numBox = await numerator(page).boundingBox();
		const denBox = await denominator(page).boundingBox();
		expect(numBox).not.toBeNull();
		expect(denBox).not.toBeNull();
		expect(numBox!.width).toBeGreaterThanOrEqual(44);
		expect(numBox!.x).toBeGreaterThanOrEqual(0);
		expect(denBox!.x + denBox!.width).toBeLessThanOrEqual(390);
		await expect(page.locator("rref-board")).toBeVisible();

		await page.keyboard.press("ArrowRight");
		await expect(drawer(page, "right")).toHaveAttribute("open", "");
		await page.waitForTimeout(350);
		const rightBox = await denominator(page, "right").boundingBox();
		expect(rightBox).not.toBeNull();
		expect(rightBox!.x + rightBox!.width).toBeLessThanOrEqual(390);
	});
});
