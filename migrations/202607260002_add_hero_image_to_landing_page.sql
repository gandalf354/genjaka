ALTER TABLE landing_page_contents
ADD COLUMN hero_image_url TEXT NULL AFTER hero_badge;

UPDATE landing_page_contents
SET hero_image_url = 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=modern%20educational%20institution%20facade%20at%20sunrise%2C%20elegant%20academic%20atmosphere%2C%20cinematic%20editorial%20photography%2C%20warm%20gold%20and%20deep%20blue%20palette%2C%20realistic%2C%20ultra%20detailed&image_size=landscape_16_9'
WHERE hero_image_url IS NULL OR hero_image_url = '';
