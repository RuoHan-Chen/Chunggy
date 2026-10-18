import "server-only";

import oracledb from "oracledb";

import { withConnection, withTransaction } from "@/server/database/transaction";
import { insurancePolicySchema } from "@/server/database/validation";

type PolicyRow = {
  policyId: string;
  payerName: string;
  planName: string;
  memberId: string;
  groupId: string | null;
  active: number;
  verificationStatus: "NOT_VERIFIED" | "REQUESTED" | "VERIFIED" | "FAILED";
};

export type InsurancePolicyRecord = Omit<PolicyRow, "active"> & { active: boolean };

export async function saveInsurancePolicy(input: unknown): Promise<InsurancePolicyRecord> {
  const policy = insurancePolicySchema.parse(input);

  return withTransaction(async (connection) => {
    await connection.execute(
      `MERGE INTO INSURANCE_POLICIES target
       USING (
         SELECT :policyId POLICY_ID,
                :userId USER_ID,
                :payerName PAYER_NAME,
                :planName PLAN_NAME,
                :memberId MEMBER_ID,
                :groupId GROUP_ID,
                :active IS_ACTIVE
         FROM DUAL
       ) source
       ON (target.POLICY_ID = source.POLICY_ID AND target.USER_ID = source.USER_ID)
       WHEN MATCHED THEN UPDATE SET
         target.PAYER_NAME = source.PAYER_NAME,
         target.PLAN_NAME = source.PLAN_NAME,
         target.MEMBER_ID = source.MEMBER_ID,
         target.GROUP_ID = source.GROUP_ID,
         target.IS_ACTIVE = source.IS_ACTIVE,
         target.UPDATED_AT = SYSTIMESTAMP
       WHEN NOT MATCHED THEN INSERT
         (POLICY_ID, USER_ID, PAYER_NAME, PLAN_NAME, MEMBER_ID, GROUP_ID, IS_ACTIVE)
       VALUES
         (source.POLICY_ID, source.USER_ID, source.PAYER_NAME, source.PLAN_NAME, source.MEMBER_ID, source.GROUP_ID, source.IS_ACTIVE)`,
      { ...policy, groupId: policy.groupId ?? null, active: policy.active ? 1 : 0 },
    );

    const policies = await selectPolicies(connection, policy.userId);
    const saved = policies.find((candidate) => candidate.policyId === policy.policyId);
    if (!saved) throw new Error("Insurance policy was not saved");
    return saved;
  });
}

export async function listInsurancePolicies(userId: string) {
  const validUserId = insurancePolicySchema.shape.userId.parse(userId);
  return withConnection((connection) => selectPolicies(connection, validUserId));
}

async function selectPolicies(connection: oracledb.Connection, userId: string) {
  const result = await connection.execute<PolicyRow>(
    `SELECT POLICY_ID AS "policyId",
            PAYER_NAME AS "payerName",
            PLAN_NAME AS "planName",
            MEMBER_ID AS "memberId",
            GROUP_ID AS "groupId",
            IS_ACTIVE AS "active",
            VERIFICATION_STATUS AS "verificationStatus"
     FROM INSURANCE_POLICIES
     WHERE USER_ID = :userId
     ORDER BY IS_ACTIVE DESC, CREATED_AT DESC`,
    { userId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );

  return (result.rows ?? []).map((row) => ({ ...row, active: row.active === 1 }));
}
