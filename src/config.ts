import yaml from 'js-yaml';

import configBuilder, { type Config } from '../vendor/integration/utils/configBuilder';
import rawYaml from './config.yaml?raw';

const { SITE, THEME, I18N, METADATA, APP_BLOG, UI, ANALYTICS } = configBuilder(yaml.load(rawYaml) as Config);

export { SITE, THEME, I18N, METADATA, APP_BLOG, UI, ANALYTICS };
