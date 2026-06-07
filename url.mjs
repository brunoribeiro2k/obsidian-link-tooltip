const EXTERNAL_URL_PATTERN = /^(?:(?:https?|ftps?|file):\/\/[^\s]+|mailto:[^\s]+|\/\/[^\s]+|www\.[^\s]+)/i;

export function isExternalUrl(url) {
	return EXTERNAL_URL_PATTERN.test(url);
}
