-- Add indexes to speed up lookups by document_type + document_number
CREATE INDEX IF NOT EXISTS idx_public_respondents_document ON public.public_respondents(document_type, document_number);
CREATE INDEX IF NOT EXISTS idx_responses_respondent_document ON public.responses(respondent_document_type, respondent_document_number);
