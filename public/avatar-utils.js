export const BRAND_ICON_192 = "/assets/icon/yam-icon-192.png";
export const BRAND_ICON_512 = "/assets/icon/yam-icon-512.png";
export const APPLE_TOUCH_ICON = "/assets/icon/yam-apple-touch-icon.png";
export const FAVICON = "/yam-favicon.png";

export const USER_GENDER = {
  MALE: "MALE",
  FEMALE: "FEMALE",
};

const GENDER_META = {
  [USER_GENDER.MALE]: {
    label: "男",
    avatar: "/assets/avatars/user-male.png",
  },
  [USER_GENDER.FEMALE]: {
    label: "女",
    avatar: "/assets/avatars/user-female.png",
  },
};

export function avatarForGender(gender) {
  return GENDER_META[gender]?.avatar || GENDER_META[USER_GENDER.FEMALE].avatar;
}

export function labelForGender(gender) {
  return GENDER_META[gender]?.label || "未设置";
}

export function isValidGender(gender) {
  return gender === USER_GENDER.MALE || gender === USER_GENDER.FEMALE;
}
