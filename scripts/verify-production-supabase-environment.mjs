import { execFileSync } from "node:child_process";

const environmentName = "production-supabase";

function gh(args) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function repositoryName() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  return gh(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
}

const repository = repositoryName();
const [owner] = repository.split("/");
if (!owner) throw new Error("Could not determine the repository owner.");

const environment = JSON.parse(
  gh([
    "api",
    `repos/${repository}/environments/${environmentName}`,
    "-H",
    "X-GitHub-Api-Version: 2026-03-10",
  ]),
);

const rules = Array.isArray(environment.protection_rules) ? environment.protection_rules : [];
const reviewerRule = rules.find((rule) => rule.type === "required_reviewers");
const reviewers = Array.isArray(reviewerRule?.reviewers) ? reviewerRule.reviewers : [];
const ownerIsReviewer = reviewers.some(
  (entry) => entry.type === "User" && entry.reviewer?.login?.toLowerCase() === owner.toLowerCase(),
);
const waitTimer = rules.find((rule) => rule.type === "wait_timer");

if (!reviewerRule || reviewers.length < 1) {
  throw new Error(`${environmentName} has no required reviewer protection.`);
}
if (!ownerIsReviewer) {
  throw new Error(`${environmentName} does not include the repository owner as a required reviewer.`);
}
if (reviewerRule.prevent_self_review !== false) {
  throw new Error(`${environmentName} prevents the sole owner approval path from proceeding.`);
}
if (waitTimer && waitTimer.wait_timer !== 0) {
  throw new Error(`${environmentName} has an unexpected wait timer.`);
}

console.log(
  JSON.stringify({
    environment: environmentName,
    requiredReviewerProtection: "PASS",
    reviewerCount: reviewers.length,
    ownerReviewer: owner,
    preventSelfReview: reviewerRule.prevent_self_review,
    waitTimerMinutes: waitTimer?.wait_timer ?? 0,
  }),
);
