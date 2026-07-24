export type DispatchScope = API.NotificationDispatchIn['scope'];

export type LabeledTargetValue = {
  value: number;
  label?: string;
};

export type CreateDispatchFormValues = {
  scope: DispatchScope;
  targets?: LabeledTargetValue[];
  category?: string;
  title: string;
  body?: string;
  url?: string;
};

export type DispatchSource = {
  id?: number;
  scope?: DispatchScope;
  scope_ids?: number[];
  category?: string;
  title?: string;
  body?: string;
  url?: string | null;
};

export type ScopeOption = {
  label: string;
  value: DispatchScope;
};

export type RecipientSummary = {
  hint: string;
  status?: string;
  needsTargetSelection: boolean;
};
