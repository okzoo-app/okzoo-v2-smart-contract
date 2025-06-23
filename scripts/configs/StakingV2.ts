import { parseUnits } from "ethers";
import { dateToUnixTimestamp, requireEnv } from "../util";

const config = {
    owner: requireEnv("OWNER_ADDRESS"),
    stakedToken: requireEnv("MAIN_TOKEN_ADDRESS"),
    rewardToken: requireEnv("MAIN_TOKEN_ADDRESS"),
    totalReward: parseUnits("5000", 18).toString(),
    startTime: dateToUnixTimestamp(requireEnv("STAKING_START_TIME")).toString(),
    endTime: dateToUnixTimestamp(requireEnv("STAKING_END_TIME")).toString(),
    lockDuration: 15 * 24 * 60 * 60, // 15 days in seconds
    maxStake: parseUnits("100000", 18).toString(),
    maxStakePerUser: 100, // 100 stakes per user
};

export default config;
