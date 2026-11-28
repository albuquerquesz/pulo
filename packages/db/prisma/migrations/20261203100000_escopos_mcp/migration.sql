-- Escopos de dados do MCP: os clientes já registrados passam a poder pedir `pulo:read` e `pulo:write`.
-- Consentimentos e tokens não mudam: quem já conectou autoriza de novo.
UPDATE "oauth_client"
SET "scopes" = "scopes" || ARRAY['pulo:read', 'pulo:write']
WHERE cardinality("scopes") > 0 AND NOT ("scopes" && ARRAY['pulo:read', 'pulo:write']);
