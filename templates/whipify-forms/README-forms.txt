Whipify Forms Plugin - Quick Start
=================================

1. In WordPress, go to Plugins > Add New > Upload Plugin
2. Upload the whipify-forms-plugin.zip file from the plugins/ folder in your theme
3. Click "Install Now" then "Activate"
4. Go to Tools > Whipify Forms
5. Click "Wire All Forms" to auto-connect your forms using Contact Form 7
   (or select WPForms / Gravity Forms if you prefer)
6. Set the email address where form submissions should be sent

The plugin will automatically create forms in your chosen form plugin
and connect the generated Whipify theme forms using the built-in runtime bridge.


Troubleshooting: Emails not arriving?
------------------------------------
After wiring, click "Test" next to your form in Tools > Whipify Forms.
If the test email doesn't arrive, your hosting provider may not support
PHP mail. Install a free SMTP plugin to fix this:

  - WP Mail SMTP (recommended): wordpress.org/plugins/wp-mail-smtp/
  - FluentSMTP: wordpress.org/plugins/fluent-smtp/

These plugins route emails through Gmail, Outlook, SendGrid, etc. instead
of relying on your server's built-in mail, which many hosts block or
filter to spam.


Troubleshooting: Fields disappear when typing, or popup form errors then vanishes?
-----------------------------------------------------------------------------------
WPForms (and most form plugins) render their own <form>. Do not wrap a [wpforms]
shortcode inside the theme's outer <form> — nested forms are invalid HTML and
browsers will rearrange the DOM (inputs can disappear when you type).

- Brochure / inline forms: replace the outer <form ... data-whipify-form-id="...">
  with a <div ... data-whipify-form-id="..."> and put only [wpforms id="…"]
  inside, OR remove the shortcode from inside any theme <form> and keep a single
  form from WPForms.

- Runtime bridge mode: the generated Whipify build keeps the original form markup
  and uses the footer bridge after wiring, so most themes do not need template edits.
