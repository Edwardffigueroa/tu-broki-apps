export class McpToolError extends Error {
  constructor(code, message, hint = null, extra = {}) {
    super(message);
    this.code = code;
    this.hint = hint;
    this.extra = extra;
  }

  toResult() {
    let text = `ERROR ${this.code}: ${this.message}`;
    if (this.hint) text += `\nSugerencia: ${this.hint}`;
    return {
      isError: true,
      content: [{ type: 'text', text }],
      structuredContent: {
        error: this.code,
        message: this.message,
        hint: this.hint,
        ...this.extra,
      },
    };
  }
}

export function fromErrorHttp(e) {
  const code = e.extra?.codigo || e.extra?.code || 'validacion';
  return new McpToolError(code, e.message, e.extra?.hint || null, { ...e.extra });
}
