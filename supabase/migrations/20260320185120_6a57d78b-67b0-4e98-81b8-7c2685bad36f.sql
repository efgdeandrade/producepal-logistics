UPDATE dre_conversations 
SET agent_state = '{"order_draft": {"items": []}}'::jsonb
WHERE external_chat_id = '-5192208780';