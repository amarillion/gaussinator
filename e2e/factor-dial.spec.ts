import { expect, test, type Locator, type Page } from "@playwright/test";

function numerator(page: Page): Locator {
	return page.locator('number-dial[data-dial="numerator"]');
}

function denominator(page: Page): Locator {
	return page.locator('number-dial[data-dial="denominator"]');
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

test.describe("factor dial", () => {
	test("renders a numerator and denominator scale with fixed needles", async ({ page }) => {
		await openGame(page);

		await expect(page.locator("factor-dial number-dial")).toHaveCount(2);
		await expect(page.locator(".k-sign")).toHaveCount(0);

		await expect(numerator(page)).toHaveAttribute("aria-label", "Numerator");
		await expect(numerator(page)).toHaveAttribute("aria-valuemin", "-20");
		await expect(numerator(page)).toHaveAttribute("aria-valuemax", "20");
		await expect(denominator(page)).toHaveAttribute("aria-label", "Denominator");
		await expect(denominator(page)).toHaveAttribute("aria-valuemin", "1");
		await expect(denominator(page)).toHaveAttribute("aria-valuemax", "20");

		await expect(numerator(page).locator(".dial-needle")).toHaveCount(1);
		await expect(denominator(page).locator(".dial-needle")).toHaveCount(1);

		const numBox = await numerator(page).boundingBox();
		const denBox = await denominator(page).boundingBox();
		expect(numBox).not.toBeNull();
		expect(denBox).not.toBeNull();
		expect(numBox!.x + numBox!.width).toBeLessThanOrEqual(denBox!.x);
	});

	test("selects an exact 2/3 factor and applies it", async ({ page }) => {
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

		await expect(page.locator("#hud .mode-label")).toHaveText("k = 2/3");

		await page.keyboard.press("m");
		await expect(page.locator("#hud .mode-label")).toContainText("Scale row 1 by 2/3");
		await page.keyboard.press("Enter");

		await expect(page.locator('[data-stat="moves"]')).toHaveText("1");
		await expect(num).toHaveAttribute("data-value", "1");
		await expect(den).toHaveAttribute("data-value", "1");
	});

	test("reaches negative numerators and denominator endpoints without a sign button", async ({ page }) => {
		await openGame(page);
		const num = numerator(page);
		const den = denominator(page);

		await num.focus();
		await page.keyboard.press("Home");
		await expect(num).toHaveAttribute("data-value", "-20");
		await expect(num).toHaveAttribute("aria-valuetext", "−20");
		await expect(page.locator("#hud .mode-label")).toHaveText("k = −20");

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
			await page.mouse.move(x, y - i * 20);
			await page.waitForTimeout(8);
		}
		await page.mouse.up();

		await page.waitForTimeout(2_200);

		const value = Number(await num.getAttribute("data-value"));
		expect(Number.isInteger(value)).toBe(true);
		expect(value).toBeGreaterThan(3);
		expect(value).toBeLessThanOrEqual(20);
	});

	test("the pair fits on a narrow mobile viewport", async ({ page }) => {
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
	});
});
