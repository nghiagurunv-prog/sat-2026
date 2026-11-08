/**
 * Hàm chuẩn hóa chuỗi dữ liệu (đặc biệt là LaTeX) do AI trả về.
 * OpenAI GPT thường trả về công thức Toán học dùng `\[ ... \]` và `\( ... \)`.
 * Thư viện `react-markdown` (kết hợp `remark-math`) lại yêu cầu `$$ ... $$` và `$ ... $`.
 */
export function cleanAiText(text: string): string {
  if (!text || typeof text !== 'string') return "";
  
  // Xóa các khoảng trắng/xuống dòng thừa ở hai đầu
  let cleaned = text.trim();

  // 1. Bảo vệ ký hiệu tiền tệ USD ($100, $25.50, $1,000) trong bài SAT không bị hiểu nhầm là dấu mở LaTeX $...$
  // Chỉ escape dấu $ khi đứng trước chữ số và chưa có backslash phía trước:
  cleaned = cleaned.replace(/(^|[^\\])\$(\d+(?:,\d{3})*(?:\.\d+)?)\b/g, '$1\\$$2');

  // 2. Chuẩn hóa Block Math: \[ ... \] hoặc \\[ ... \\] (kể cả escape kép từ LLM) -> $$ ... $$
  cleaned = cleaned.replace(/\\\\\[([\s\S]*?)\\\\\]/g, '$$$$$1$$$$');
  cleaned = cleaned.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');
  cleaned = cleaned.split('\\\\[').join('$$').split('\\\\\\]').join('$$');
  cleaned = cleaned.split('\\[').join('$$').split('\\]').join('$$');

  // 3. Chuẩn hóa Inline Math: \( ... \) hoặc \\( ... \\) (kể cả escape kép từ LLM) -> $ ... $
  cleaned = cleaned.replace(/\\\\\(([\s\S]*?)\\\\\)/g, '$$$1$$');
  cleaned = cleaned.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');
  cleaned = cleaned.split('\\\\(').join('$').split('\\\\)').join('$');
  cleaned = cleaned.split('\\(').join('$').split('\\)').join('$');
  
  return cleaned;
}
