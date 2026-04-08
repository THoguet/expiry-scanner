import { Format } from "@tauri-apps/plugin-barcode-scanner";

/** Transient error/toast auto-dismiss duration (ms). */
export const TRANSIENT_ERROR_DURATION_MS = 3_000;

/** Delay before programmatic focus to let the DOM settle (ms). */
export const FOCUS_DELAY_MS = 100;

/** Maximum allowed image upload size in bytes (10 MB). */
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

/** How many years into the future an expiry date is considered valid. */
export const MAX_EXPIRY_YEARS_AHEAD = 20;

/** Debounce period before triggering a lookup for shorter, compatible barcode formats (ms). */
export const BARCODE_DEBOUNCE_MS = 600;

/** Century prefix used when expanding 2-digit years to full dates. */
export const CENTURY_PREFIX = "20";

/**
 * Source-of-truth barcode format definitions.
 * Order matters: longest-first keeps matching deterministic when scanning by length.
 */
const BARCODE_FORMAT_DEFINITIONS = [
	[Format.EAN13, 13],
	[Format.EAN8, 8],
	[Format.UPC_A, 12],
	[Format.UPC_E, 8],
] as const;

/**
 * Native barcode formats accepted by the app.
 */
export const SUPPORTED_BARCODE_FORMATS: readonly Format[] = BARCODE_FORMAT_DEFINITIONS.map(
	([format]) => format,
);

/** Digit count for each supported native barcode format. */
export const BARCODE_DIGIT_COUNT_BY_FORMAT: ReadonlyMap<Format, number> = new Map(
	BARCODE_FORMAT_DEFINITIONS,
);

/**
 * The longest format — if a barcode reaches this length, it can advance focus automatically.
 * `SUPPORTED_BARCODE_FORMATS` is intentionally declared longest-first.
 */
export const LONGEST_BARCODE_FORMAT = SUPPORTED_BARCODE_FORMATS[0];

/** The maximum digit count across all supported formats (used for input `maxlength`). */
export const MAX_BARCODE_LENGTH = BARCODE_DIGIT_COUNT_BY_FORMAT.get(LONGEST_BARCODE_FORMAT) ?? 0;

/** Returns the expected digit count for a given native format. */
export function getBarcodeDigitCount(format: Format): number | undefined {
	return BARCODE_DIGIT_COUNT_BY_FORMAT.get(format);
}

/** Returns the matching native format for the barcode length, or `undefined` if unsupported. */
export function findMatchingFormat(value: string): Format | undefined {
	return SUPPORTED_BARCODE_FORMATS.find(
		(format) => getBarcodeDigitCount(format) === value.length,
	);
}
