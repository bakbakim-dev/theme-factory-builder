import whipifyFormsPluginPhp from '../templates/whipify-forms/whipify-forms-plugin.php?raw';
import whipifyFormsReadme from '../templates/whipify-forms/README-forms.txt?raw';

export const WHIPIFY_FORMS_PLUGIN_FILES: Record<string, string> = {
  'whipify-forms-plugin.php': whipifyFormsPluginPhp,
};

export const WHIPIFY_FORMS_README = whipifyFormsReadme;
