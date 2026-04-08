import { describe, expect, it } from "vitest";
import { Format } from "@tauri-apps/plugin-barcode-scanner";

import {
	BARCODE_DEBOUNCE_MS,
	BARCODE_DIGIT_COUNT_BY_FORMAT,
	CENTURY_PREFIX,
	FOCUS_DELAY_MS,
	getBarcodeDigitCount,
	LONGEST_BARCODE_FORMAT,
	MAX_BARCODE_LENGTH,
	MAX_EXPIRY_YEARS_AHEAD,
	MAX_IMAGE_SIZE_BYTES,
	SUPPORTED_BARCODE_FORMATS,
	TRANSIENT_ERROR_DURATION_MS,
	findMatchingFormat,
} from "./constants";

describe("constants", () => {
	it("exports numeric constants with sensible values", () => {
		expect(TRANSIENT_ERROR_DURATION_MS).toBeGreaterThan(0);
		expect(FOCUS_DELAY_MS).toBeGreaterThan(0);
		expect(BARCODE_DEBOUNCE_MS).toBeGreaterThan(0);
		expect(MAX_IMAGE_SIZE_BYTES).toBe(10 * 1024 * 1024);
		expect(MAX_EXPIRY_YEARS_AHEAD).toBeGreaterThan(0);
		expect(CENTURY_PREFIX).toBe("20");
	});

	describe("format-length mapping", () => {
		it("is ordered longest-first", () => {
			for (let i = 1; i < SUPPORTED_BARCODE_FORMATS.length; i++) {
				const previous = getBarcodeDigitCount(SUPPORTED_BARCODE_FORMATS[i - 1]) ?? 0;
				const current = getBarcodeDigitCount(SUPPORTED_BARCODE_FORMATS[i]) ?? 0;
				expect(previous).toBeGreaterThanOrEqual(current);
			}
		});

		it("each supported format has a positive digit count", () => {
			for (const format of SUPPORTED_BARCODE_FORMATS) {
				expect(getBarcodeDigitCount(format)).toBeGreaterThan(0);
			}
		});

		it("exposes known plugin formats in the digit-count map", () => {
			expect(BARCODE_DIGIT_COUNT_BY_FORMAT.get(Format.EAN13)).toBe(13);
			expect(BARCODE_DIGIT_COUNT_BY_FORMAT.get(Format.EAN8)).toBe(8);
		});
	});

	it("MAX_BARCODE_LENGTH equals the longest format digit count", () => {
		expect(MAX_BARCODE_LENGTH).toBe(getBarcodeDigitCount(LONGEST_BARCODE_FORMAT));
	});

	describe("findMatchingFormat", () => {
		it("returns the native format for a matching length", () => {
			const ean13 = findMatchingFormat("1234567890123");
			expect(ean13).toBe(Format.EAN13);

			const ean8 = findMatchingFormat("12345678");
			expect(ean8).toBe(Format.EAN8);
		});

		it("returns undefined for non-matching lengths", () => {
			expect(findMatchingFormat("123")).toBeUndefined();
			expect(findMatchingFormat("")).toBeUndefined();
			expect(findMatchingFormat("123456789012")).toBeUndefined();
		});
	});
});
