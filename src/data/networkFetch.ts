/** Keep web uploads on the browser's Blob/FormData implementation. */
export const networkFetch:typeof fetch=(input,init)=>globalThis.fetch(input,init);
