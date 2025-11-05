-- Add new herb product categories
INSERT INTO products (code, name, pack_size, unit) VALUES
-- HERBS PACKS (xcd 2.00)
('HP_MINT', 'Mint', 1, 'pack'),
('HP_PEPPERMINT', 'Peppermint', 1, 'pack'),
('HP_BASIL', 'Basil', 1, 'pack'),
('HP_PURPLE_BASIL', 'Purple Basil', 1, 'pack'),
('HP_YERBI_HOLE', 'Yerb''i Hole', 1, 'pack'),
('HP_LEMON_BASIL', 'Lemon Basil', 1, 'pack'),
('HP_LEMONGRASS', 'Lemongrass', 1, 'pack'),
('HP_OREGANO', 'Oregano', 1, 'pack'),
('HP_LIPPIA_ALBA', 'Lippia Alba', 1, 'pack'),
('HP_CILANTRO', 'Cilantro', 1, 'pack'),
('HP_PARSLEY', 'Parsley', 1, 'pack'),
('HP_ROMERO', 'Romero', 1, 'pack'),
('HP_THYME', 'Thyme', 1, 'pack'),
('HP_DILL', 'Dill', 1, 'pack'),
('HP_SAGE', 'Sage', 1, 'pack'),
('HP_CHIVES', 'Chives', 1, 'pack'),
('HP_TARRAGON', 'Tarragon', 1, 'pack'),
('HP_MORINGA', 'Moringa', 1, 'pack'),
('HP_EUCALYPTUS', 'Eucalyptus', 1, 'pack'),
('HP_BAY', 'Bay', 1, 'pack'),
('HP_GUASCA', 'Guasca', 1, 'pack'),
('HP_CALENDULA', 'Calendula', 1, 'pack'),
('HP_CAMOMILE', 'Camomile', 1, 'pack'),
('HP_MARJORAM', 'Marjoram', 1, 'pack'),
('HP_RUDA', 'Ruda', 1, 'pack'),
('HP_PARSLEY_ITALIAN', 'Parsley Italian', 1, 'pack'),

-- HERBS BOX (xcc 11.00)
('HB_MINT', 'Mint', 1, 'box'),
('HB_BASIL', 'Basil', 1, 'box'),
('HB_LEMONGRASS', 'Lemongrass', 1, 'box'),
('HB_ROMERO', 'Romero', 1, 'box'),
('HB_THYME', 'Thyme', 1, 'box'),
('HB_LIPPIA_ALBA', 'Lippia Alba', 1, 'box'),

-- MICROGREENS (xcc 5.00)
('MG_AMARANTH', 'Amaranth', 1, 'tray'),
('MG_ARUGULA', 'Arugula', 1, 'tray'),
('MG_ITALIAN_BASIL', 'Italian Basil', 1, 'tray'),
('MG_MIZUNA', 'Mizuna', 1, 'tray'),
('MG_MUSTARD', 'Mustard', 1, 'tray'),
('MG_GREEN_RADISH', 'Green Radish', 1, 'tray'),
('MG_RED_RADISH', 'Red Radish', 1, 'tray'),
('MG_TENDRIL', 'Tendril', 1, 'tray'),

-- SPROUTS (xcc 3.5)
('SP_TAUGE', 'Tauge', 1, 'bag'),
('SP_ALFALFA', 'Alfalfa', 1, 'bag')
ON CONFLICT (code) DO NOTHING;