import type { HouseFieldLabels } from '@/components/house-field';
import type { TranslationKey } from '@/lib/i18n/dictionary';

/** The house-number field's wording from the translation dictionaries (join page,
 *  community settings — the elder-facing, translated screens). */
export function houseLabels(t: (key: TranslationKey) => string): HouseFieldLabels {
  return {
    block: t('community.house.block'),
    blockPlaceholder: t('community.house.blockPlaceholder'),
    number: t('community.house.number'),
    numberPlaceholder: t('community.house.numberPlaceholder'),
    houseName: t('community.house.houseName'),
    houseNamePlaceholder: t('community.house.houseNamePlaceholder'),
    useName: t('community.house.useName'),
    useBlock: t('community.house.useBlock'),
    helper: t('community.house.helper'),
  };
}
