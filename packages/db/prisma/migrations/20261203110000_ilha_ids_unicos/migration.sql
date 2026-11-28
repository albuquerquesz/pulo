-- 'ponte' e 'balanco' existem na ilha antiga e na casa, e a chave é (userId, item): a compra antiga impedia a da casa.
-- As antigas ganham o prefixo `antiga:` (o mapeador tira na leitura). Nenhuma compra é apagada.
UPDATE "island_purchase"
SET "item" = 'antiga:' || "item"
WHERE "kind" = 'antiga' AND "item" IN ('ponte', 'balanco');
