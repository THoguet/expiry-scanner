import { emit } from "@tauri-apps/api/event";
import {
	cancel,
	checkPermissions,
	type Format,
	requestPermissions,
	scan,
} from "@tauri-apps/plugin-barcode-scanner";
import { computed, onBeforeUnmount, onMounted, ref, watch, watchEffect } from "vue";
import type { ProductPrefill } from "../../bindings/ProductPrefill";
import {
	BARCODE_DEBOUNCE_MS,
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
} from "../../constants";
import { CLIENT_ID } from "../../main";
import { addProduct, useProducts } from "../../services/products";
import { logger } from "../../services/logger";

interface ProductInfo {
	barCode: string;
	name: string;
	expiryDay: string | null;
	expiryMonth: string | null;
	expiryYear: string | null;
}

function currentYear2Digits(): string {
	const fullYear = new Date().getFullYear();
	return String(fullYear % parseInt(CENTURY_PREFIX + "00", 10));
}

export function useAddProductForm() {
	const scanning = ref(false);
	const prefilling = ref(false);
	const isSubmitting = ref(false);

	const productInfo = ref<ProductInfo>({
		barCode: "",
		name: "",
		expiryDay: null,
		expiryMonth: null,
		expiryYear: currentYear2Digits(),
	});

	const prefilled = ref<ProductPrefill | null>(null);
	const scanError = ref<string | null>(null);
	const addError = ref<string | null>(null);
	const imageUploadError = ref<string | null>(null);
	const showNameError = ref(false);

	const selectedImage = ref<File | null>(null);
	const imagePreview = ref<string | null>(null);

	const productBarCodeInput = ref<HTMLInputElement | null>(null);
	const productNameInput = ref<HTMLInputElement | null>(null);
	const expiryDayInput = ref<HTMLInputElement | null>(null);
	const expiryMonthInput = ref<HTMLInputElement | null>(null);
	const expiryYearInput = ref<HTMLInputElement | null>(null);
	const cameraCaptureInput = ref<HTMLInputElement | null>(null);

	let barcodeLookupTimer: ReturnType<typeof setTimeout> | null = null;
	let prefillGeneration = 0;

	const canLookupBarcode = computed(() => Boolean(findMatchingFormat(productInfo.value.barCode.trim())));

	const inputOrder = [expiryDayInput, expiryMonthInput];

	watch(scanning, (isScanning) => {
		document.body.classList.toggle("scan-active", isScanning);
	});

	watch(
		productInfo,
		() => {
			if (addError.value) {
				addError.value = null;
			}

			if (productInfo.value.expiryDay && !isDayValid(productInfo.value.expiryDay)) {
				expiryDayInput.value?.classList.add("input-error");
			} else {
				expiryDayInput.value?.classList.remove("input-error");
			}

			if (productInfo.value.expiryMonth && !isMonthValid(productInfo.value.expiryMonth)) {
				expiryMonthInput.value?.classList.add("input-error");
			} else {
				expiryMonthInput.value?.classList.remove("input-error");
			}

			if (productInfo.value.expiryYear && !isYearValid(productInfo.value.expiryYear)) {
				expiryYearInput.value?.classList.add("input-error");
			} else {
				expiryYearInput.value?.classList.remove("input-error");
			}
		},
		{ deep: true },
	);

	watchEffect(() => {
		if (scanning.value) {
			blurAllInputs();
		}
	});

	onMounted(() => {
		logger.info("Add product form mounted, starting scanner");
		void startScan();
	});

	onBeforeUnmount(() => {
		logger.info("Add product form unmounted, cancelling scanner");
		if (barcodeLookupTimer) {
			clearTimeout(barcodeLookupTimer);
		}
		cancelScan();
		document.body.classList.toggle("scan-active", false);
	});

	function isDayValid(day: string | null): boolean {
		if (!day) return false;
		const dayNum = parseInt(day, 10);
		return dayNum >= 1 && dayNum <= 31;
	}

	function isMonthValid(month: string | null): boolean {
		if (!month) return false;
		const monthNum = parseInt(month, 10);
		return monthNum >= 1 && monthNum <= 12;
	}

	function isYearValid(year: string | null): boolean {
		if (!year) return false;
		const yearNum = parseInt(year, 10);
		const currentYear = new Date().getFullYear() % parseInt(CENTURY_PREFIX + "00", 10);
		return yearNum >= currentYear && yearNum <= currentYear + MAX_EXPIRY_YEARS_AHEAD;
	}

	function blurAllInputs(): void {
		productBarCodeInput.value?.blur();
		productNameInput.value?.blur();
		expiryDayInput.value?.blur();
		expiryMonthInput.value?.blur();
		expiryYearInput.value?.blur();
	}

	function goToNext(event: Event, forceNext = false): void {
		const target = event.target as HTMLInputElement;
		const value = target.value;
		const maxLength = target.maxLength > 0 ? target.maxLength : 2;

		if (value.length >= maxLength || forceNext) {
			const currentIndex = inputOrder.findIndex((input) => input.value === target);
			if (currentIndex !== -1 && currentIndex < inputOrder.length - 1) {
				inputOrder[currentIndex + 1].value?.focus();
			} else if (currentIndex === inputOrder.length - 1) {
				void createNewProduct();
				blurAllInputs();
			}
		}
	}

	async function createNewProduct(): Promise<void> {
		const verificationResult = verifyProductInfo();
		if (verificationResult !== true) {
			logger.warn("Product info validation failed", {
				reason: verificationResult,
				barcode: productInfo.value.barCode,
			});
			setAddError(verificationResult as string);
			return;
		}

		isSubmitting.value = true;
		try {
			const imageBase64 = selectedImage.value ? await toBase64Payload(selectedImage.value) : null;
			logger.info("Submitting new product", {
				barcode: productInfo.value.barCode,
				hasImage: Boolean(imageBase64),
			});

			await addProduct({
				barcode: productInfo.value.barCode,
				name: productInfo.value.name,
				image: null,
				image_base64: imageBase64,
				expiration_date: `${CENTURY_PREFIX + productInfo.value.expiryYear}-${String(productInfo.value.expiryMonth).padStart(2, "0")}-${String(productInfo.value.expiryDay).padStart(2, "0")}`,
				client_id: CLIENT_ID,
			});

			emit("productAdded");
			logger.info("Product added from form", {
				barcode: productInfo.value.barCode,
			});
			resetForm();
			inputOrder[0].value?.focus();
		} catch (error) {
			logger.error("Error creating product from form", {
				error,
				barcode: productInfo.value.barCode,
			});
			setAddError("Failed to add product");
		} finally {
			isSubmitting.value = false;
		}
	}

	function resetForm(): void {
		if (barcodeLookupTimer) {
			clearTimeout(barcodeLookupTimer);
			barcodeLookupTimer = null;
		}
		prefillGeneration++;
		productInfo.value = {
			barCode: "",
			name: "",
			expiryDay: null,
			expiryMonth: null,
			expiryYear: currentYear2Digits(),
		};
		prefilled.value = null;
		selectedImage.value = null;
		imagePreview.value = null;
		showNameError.value = false;
		imageUploadError.value = null;
	}

	function setAddError(message: string): void {
		addError.value = message;
		setTimeout(() => {
			addError.value = null;
		}, TRANSIENT_ERROR_DURATION_MS);
	}

	function verifyProductInfo(): string | boolean {
		if (!productInfo.value.barCode) {
			return "Barcode is required";
		}
		if (!productInfo.value.name || productInfo.value.name.trim() === "") {
			return "Product name is required";
		}
		if (!productInfo.value.expiryDay || !productInfo.value.expiryMonth || !productInfo.value.expiryYear) {
			return "All expiry fields are required";
		}
		const day = parseInt(productInfo.value.expiryDay, 10);
		const month = parseInt(productInfo.value.expiryMonth, 10);
		const year = parseInt(CENTURY_PREFIX + productInfo.value.expiryYear, 10);
		if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) {
			return "Invalid expiry date";
		}
		if (day < 1 || day > 31 || month < 1 || month > 12) {
			return "Invalid expiry date";
		}
		return true;
	}

	function onNameInput(): void {
		showNameError.value = false;
		if (addError.value) {
			addError.value = null;
		}
	}

	function selectInput(inputRef: FocusEvent): void {
		(inputRef.target as HTMLInputElement).select();
	}

	function setImagePreview(file: File): void {
		const reader = new FileReader();
		reader.onload = (e) => {
			imagePreview.value = e.target?.result as string;
		};
		reader.readAsDataURL(file);
	}

	function toBase64Payload(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const result = reader.result;
				if (typeof result !== "string") {
					reject(new Error("Failed to read image"));
					return;
				}

				const base64 = result.includes(",") ? result.split(",")[1] : result;
				if (!base64) {
					reject(new Error("Failed to encode image"));
					return;
				}

				resolve(base64);
			};
			reader.onerror = () => reject(new Error("Failed to encode image"));
			reader.readAsDataURL(file);
		});
	}

	function openSystemCamera(): void {
		imageUploadError.value = null;
		cameraCaptureInput.value?.click();
	}

	function onSystemCameraImageSelected(event: Event): void {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];

		if (!file) return;

		if (file.size > MAX_IMAGE_SIZE_BYTES) {
			imageUploadError.value = "Image must be smaller than 10MB";
			setTimeout(() => {
				imageUploadError.value = null;
			}, TRANSIENT_ERROR_DURATION_MS);
			return;
		}

		selectedImage.value = file;
		setImagePreview(file);

		if (cameraCaptureInput.value) {
			cameraCaptureInput.value.value = "";
		}
	}

	async function retakeImage(): Promise<void> {
		clearImage();
		openSystemCamera();
	}

	function clearImage(): void {
		selectedImage.value = null;
		imagePreview.value = null;
	}

	function cancelScan(): void {
		logger.debug("Cancelling barcode scan");
		cancel();
		scanning.value = false;
	}

	async function startScan(): Promise<void> {
		scanError.value = null;
		logger.debug("Starting barcode scan flow");
		try {
			let permissionState = await checkPermissions();

			if (permissionState !== "granted") {
				permissionState = await requestPermissions();
			}

			logger.debug("Barcode scanner permission state", { permissionState });

			if (permissionState !== "granted") {
				logger.warn("Camera permission not granted");
				scanError.value = "Camera permission not granted";
				return;
			}

			scanning.value = true;
			const scannerFormats: Format[] = [...SUPPORTED_BARCODE_FORMATS];
			const result = await scan({ windowed: true, formats: scannerFormats });
			scanning.value = false;
			logger.debug("Barcode scan finished", {
				hasResult: Boolean(result),
				format: result?.format,
			});

			if (result) {
				const isSupported = SUPPORTED_BARCODE_FORMATS.includes(result.format as Format);
				if (!isSupported) {
					logger.warn("Scanned unsupported barcode format", { format: result.format });
					scanError.value = "Scanned code is in invalid format (" + result.format + ")";
					return;
				}

				productInfo.value.barCode = result.content;
				await loadPrefill(result.content, true);
			}
		} catch (error) {
			logger.error("Barcode scan failed", { error });
			scanError.value = "Failed to scan barcode";
		}
	}

	async function loadPrefill(barcode: string, shouldAdvanceFocus: boolean): Promise<void> {
		const generation = ++prefillGeneration;
		prefilling.value = true;
		logger.debug("Loading barcode prefill", { barcode });
		try {
			const { getPrefill } = useProducts(CLIENT_ID);
			const prefillData = await getPrefill(barcode);

			if (generation !== prefillGeneration) return;

			prefilled.value = prefillData;
			logger.debug("Barcode prefill loaded", {
				barcode,
				source: prefillData.source,
				hasName: Boolean(prefillData.name),
			});

			if (prefillData.name) {
				productInfo.value.name = prefillData.name;
				if (shouldAdvanceFocus) {
					setTimeout(() => {
						expiryDayInput.value?.focus();
					}, FOCUS_DELAY_MS);
				}
			} else {
				if (shouldAdvanceFocus) {
					setTimeout(() => {
						productNameInput.value?.focus();
					}, FOCUS_DELAY_MS);
				}
			}
		} catch (error) {
			if (generation !== prefillGeneration) return;

			logger.warn("Prefill lookup failed, using fallback", {
				barcode,
				error,
			});
			prefilled.value = {
				barcode,
				name: null,
				image: null,
				source: "none",
			};
			if (shouldAdvanceFocus) {
				setTimeout(() => {
					productNameInput.value?.focus();
				}, FOCUS_DELAY_MS);
			}
		} finally {
			if (generation === prefillGeneration) {
				prefilling.value = false;
			}
		}
	}

	function getSourceLabel(source: string): string {
		switch (source) {
			case "barcode_db":
				return "from database";
			case "user_product_info":
				return "saved";
			case "user_product_info_global":
				return "from others";
			case "none":
				return "no match";
			default:
				return source;
		}
	}

	function onBarcodeInput(): void {
		if (barcodeLookupTimer) {
			clearTimeout(barcodeLookupTimer);
			barcodeLookupTimer = null;
		}

		const trimmed = productInfo.value.barCode.trim();

		if (prefilled.value && prefilled.value.barcode !== trimmed) {
			prefilled.value = null;
			productInfo.value.name = "";
			imagePreview.value = null;
			selectedImage.value = null;
		}

		const matchedFormat = findMatchingFormat(trimmed);
		if (!matchedFormat) {
			return;
		}

		if (matchedFormat === LONGEST_BARCODE_FORMAT) {
			void loadPrefill(trimmed, true);
			return;
		}

		barcodeLookupTimer = setTimeout(() => {
			void loadPrefill(trimmed, false);
		}, BARCODE_DEBOUNCE_MS);
	}

	function triggerBarcodeLookup(): void {
		const trimmed = productInfo.value.barCode.trim();
		const matchedFormat = findMatchingFormat(trimmed);
		if (!matchedFormat) {
			return;
		}

		if (matchedFormat !== LONGEST_BARCODE_FORMAT) {
			logger.debug("Manual lookup started for shorter supported barcode format", {
				barcode: trimmed,
				format: matchedFormat,
				digitCount: getBarcodeDigitCount(matchedFormat),
			});
		}

		void loadPrefill(trimmed, matchedFormat === LONGEST_BARCODE_FORMAT);
	}

	function onNameKeydown(event: KeyboardEvent): void {
		if (event.key === "Enter") {
			event.preventDefault();
			if (productInfo.value.name.trim()) {
				expiryDayInput.value?.focus();
			} else {
				showNameError.value = true;
			}
		}
	}

	return {
		scanning,
		prefilling,
		isSubmitting,
		productInfo,
		prefilled,
		scanError,
		addError,
		imageUploadError,
		showNameError,
		imagePreview,
		maxBarcodeLength: MAX_BARCODE_LENGTH,
		canLookupBarcode,
		productBarCodeInput,
		productNameInput,
		expiryDayInput,
		expiryMonthInput,
		expiryYearInput,
		cameraCaptureInput,
		goToNext,
		createNewProduct,
		onNameInput,
		selectInput,
		clearImage,
		retakeImage,
		openSystemCamera,
		onSystemCameraImageSelected,
		startScan,
		cancelScan,
		getSourceLabel,
		onBarcodeInput,
		triggerBarcodeLookup,
		onNameKeydown,
	};
}
