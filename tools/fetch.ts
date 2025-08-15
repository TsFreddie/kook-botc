// 获取角色数据

interface RoleType {
  id: string;
  name: string;
  ability: string;
  image: string;
  flavor: string;
  firstNightReminder: string;
  otherNightReminder: string;
  setup: string;
  reminders: string[];
  display: number;
  remindersGlobal: string[];
  team: string;
  firstNight: number;
  otherNight: number;
  edition: string;
  isOfficial: boolean;
}

const rolesUrl = "https://clocktower.gstonegames.com/ct/grimoireRoleJson/";

const roles = await(await fetch(rolesUrl, { method: "POST" })).json() as {
  status: number;
  data?: {
    fabled: Omit<RoleType, "edition">[];
    role: RoleType[];
  };
};
