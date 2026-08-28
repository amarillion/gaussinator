import { describe, expect, it } from "vitest";
import { Rational } from "./rational";

const r = (n: bigint | number, d?: bigint | number) => new Rational(n, d);

describe("Rational", () => {
	it("normalizes fractions", () => {
		expect(r(2, 4).toString()).toBe("1/2");
		expect(r(-2, -4).toString()).toBe("1/2");
		expect(r(2, -4).toString()).toBe("-1/2");
		expect(r(0, 5).toString()).toBe("0");
		expect(r(6, 3).toString()).toBe("2");
	});

	it("adds, subtracts, multiplies and divides", () => {
		expect(r(1, 2).add(r(1, 3)).toString()).toBe("5/6");
		expect(r(1, 2).sub(r(1, 3)).toString()).toBe("1/6");
		expect(r(2, 3).mul(r(3, 4)).toString()).toBe("1/2");
		expect(r(2, 3).div(r(4, 9)).toString()).toBe("3/2");
	});

	it("handles negation, inverse and zero checks", () => {
		expect(r(3, 4).neg().toString()).toBe("-3/4");
		expect(r(3, 4).inv().toString()).toBe("4/3");
		expect(Rational.ZERO.isZero()).toBe(true);
		expect(Rational.ONE.isOne()).toBe(true);
		expect(r(2).equals(r(4, 2))).toBe(true);
	});

	it("throws on division by zero", () => {
		expect(() => r(1).div(Rational.ZERO)).toThrow();
		expect(() => r(1, 0)).toThrow();
	});

	it("parses strings", () => {
		expect(Rational.parse("3")?.toString()).toBe("3");
		expect(Rational.parse("-3/4")?.toString()).toBe("-3/4");
		expect(Rational.parse("0/2")?.toString()).toBe("0");
		expect(Rational.parse("1/0")).toBeNull();
		expect(Rational.parse("3/")).toBeNull();
		expect(Rational.parse("abc")).toBeNull();
		expect(Rational.parse("-/2")).toBeNull();
	});
});
