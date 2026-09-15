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

  const isInactive = message.toLowerCase().includes('inactive');
  return {
    isInactive,
    message: isInactive
      ? message
      : 'Email or password incorrect. Please correct it and try again.'
  };
}
