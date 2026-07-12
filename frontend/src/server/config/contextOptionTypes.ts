export type ContextOption = {
  value: string;
  label: string;
  description?: string;
};

export type ContextCategory = {
  key: string;
  label: string;
  options: ContextOption[];
};

export type ContextOptionsData = {
  categories: ContextCategory[];
};
