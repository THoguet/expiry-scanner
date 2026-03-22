export function getClientId(): string {
	let clientId = localStorage.getItem("clientId");
	if (!clientId) {
		clientId = crypto.randomUUID();
		localStorage.setItem("clientId", clientId);
	}
	return clientId;
}

export function setClientId(clientId: string): void {
	localStorage.setItem("clientId", clientId);
}

export function generateNewClientId(): string {
	const newClientId = crypto.randomUUID();
	localStorage.setItem("clientId", newClientId);
	return newClientId;
}

export function shareClientId(clientId: string): Promise<void> {
	if (!navigator.share) {
		// Fallback: copy to clipboard
		return navigator.clipboard.writeText(clientId)
			.then(() => {
				console.log('Client ID copied to clipboard');
			});
	}

	return navigator.share({
		title: 'Expiry Scanner Client ID',
		text: `My Expiry Scanner Client ID: ${clientId}`,
	});
}