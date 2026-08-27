function absBig(n: bigint): bigint {
  return n < 0n ? -n : n;
}

function gcdBig(a: bigint, b: bigint): bigint {
  let x = absBig(a);
  let y = absBig(b);
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

/**
 * Exact rational number backed by BigInt numerator/denominator.
 * Invariants: denominator > 0, fraction fully reduced, zero is 0/1.
 */
export class Rational {
  readonly n: bigint;
  readonly d: bigint;

  constructor(n: bigint | number, d: bigint | number = 1n) {
    let num = typeof n === "number" ? BigInt(n) : n;
    let den = typeof d === "number" ? BigInt(d) : d;
    if (den === 0n) {
      throw new Error("Rational denominator cannot be zero");
    }
    if (num === 0n) {
      num = 0n;
      den = 1n;
    } else if (den < 0n) {
      num = -num;
      den = -den;
    }
    const g = gcdBig(num, den);
    this.n = num / g;
    this.d = den / g;
  }

  static readonly ZERO = new Rational(0n);
  static readonly ONE = new Rational(1n);
  static readonly MINUS_ONE = new Rational(-1n);

  static parse(s: string): Rational | null {
    const t = s.trim();
    const m = /^(-?\d+)(?:\/(-?\d+))?$/.exec(t);
    if (!m) return null;
    const num = BigInt(m[1]);
    const den = m[2] !== undefined ? BigInt(m[2]) : 1n;
    if (den === 0n) return null;
    return new Rational(num, den);
  }

  add(o: Rational): Rational {
    return new Rational(this.n * o.d + o.n * this.d, this.d * o.d);
  }

  sub(o: Rational): Rational {
    return new Rational(this.n * o.d - o.n * this.d, this.d * o.d);
  }

  mul(o: Rational): Rational {
    return new Rational(this.n * o.n, this.d * o.d);
  }

  div(o: Rational): Rational {
    if (o.n === 0n) throw new Error("Division by zero");
    return new Rational(this.n * o.d, this.d * o.n);
  }

  neg(): Rational {
    return new Rational(-this.n, this.d);
  }

  inv(): Rational {
    if (this.n === 0n) throw new Error("Inverse of zero");
    return new Rational(this.d, this.n);
  }

  isZero(): boolean {
    return this.n === 0n;
  }

  isOne(): boolean {
    return this.n === 1n && this.d === 1n;
  }

  equals(o: Rational): boolean {
    return this.n === o.n && this.d === o.d;
  }

  /** Approximate float, used only for tile coloring. Not exact for huge values. */
  toNumber(): number {
    return Number(this.n) / Number(this.d);
  }

  toString(): string {
    return this.d === 1n ? this.n.toString() : `${this.n.toString()}/${this.d.toString()}`;
  }
}
