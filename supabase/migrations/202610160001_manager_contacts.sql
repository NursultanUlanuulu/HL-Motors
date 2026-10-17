-- Contact details supplied by the site owner. Applied once during deployment.
update public.site_settings set contacts = (contacts - 'email') || '{
  "whatsapp":"8615060761179", "whatsappName":"HUA",
  "whatsappSecondary":"996502102270", "whatsappSecondaryName":"Нурсултан",
  "telegram":"nursauto_kg", "wechatId":"YH15060761179", "wechatQr":"/contacts/wechat-hua.jpg"
}'::jsonb where id = 'main';
