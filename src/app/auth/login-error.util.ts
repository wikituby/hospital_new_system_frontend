export function parseLoginFailure(error: any): { isInactive: boolean; message: string } {
  const body = error?.error;
  let message = '';

  if (typeof body === 'string') {
    message = body;
  } else if (body?.message) {
    message = String(body.message);
  } else if (body?.error) {
    message = String(body.error);
  } else if (error?.message) {
    message = String(error.message);
  }

  const normalized = message.toLowerCase();
  const showServerMessage =
    normalized.includes('inactive') || normalized.includes('no role');
  return {
    isInactive: showServerMessage,
    message: showServerMessage
      ? message
      : 'Email or password incorrect. Please correct it and try again.'
  };
}
