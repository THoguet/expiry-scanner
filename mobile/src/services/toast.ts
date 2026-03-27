import { ref } from "vue";

export type ToastKind = "success" | "error";

export type Toast = {
	id: number;
	message: string;
	kind: ToastKind;
};

const toasts = ref<Toast[]>([]);
const defaultDurationMs = 2500;
let nextToastId = 1;

function dismiss(id: number): void {
	toasts.value = toasts.value.filter((toast) => toast.id !== id);
}

function show(message: string, kind: ToastKind, durationMs: number = defaultDurationMs): number {
	const id = nextToastId;
	nextToastId += 1;

	toasts.value = [...toasts.value, { id, message, kind }];

	window.setTimeout(() => {
		dismiss(id);
	}, durationMs);

	return id;
}

function success(message: string, durationMs?: number): number {
	return show(message, "success", durationMs);
}

function error(message: string, durationMs?: number): number {
	return show(message, "error", durationMs);
}

export function useToast() {
	return {
		toasts,
		show,
		success,
		error,
		dismiss,
	};
}
