# AWS S3 setup (`api-survey-app`)

Survey photos are uploaded by the NestJS API ([`StorageService`](../apps/api/src/storage/storage.service.ts)) to prefix `uploads/...` and stored as permanent public HTTPS URLs on `Photo.url`.

| Setting      | Value                                          |
| ------------ | ---------------------------------------------- |
| Region       | `ap-south-1` (Mumbai)                          |
| Bucket       | `api-survey-app`                               |
| Public reads | `s3:GetObject` on `uploads/*` only             |
| Writes       | IAM access keys (`PutObject` / `DeleteObject`) |

## Option A — CloudFormation (recommended)

Deploy the stack in **ap-south-1**:

```bash
aws cloudformation deploy \
  --region ap-south-1 \
  --stack-name api-survey-app-s3 \
  --template-file infra/s3-api-survey-app.yaml \
  --capabilities CAPABILITY_NAMED_IAM CAPABILITY_IAM
```

Requires IAM create permissions. Bucket uses `DeletionPolicy: Retain` (safe on stack delete).

Fetch credentials from stack outputs:

```bash
aws cloudformation describe-stacks \
  --region ap-south-1 \
  --stack-name api-survey-app-s3 \
  --query "Stacks[0].Outputs"
```

Copy `AccessKeyId` → `AWS_ACCESS_KEY_ID` and `SecretAccessKey` → `AWS_SECRET_ACCESS_KEY`.

## Option B — AWS Console (no CLI)

### 1. Create the bucket

Open [Create bucket `api-survey-app` (ap-south-1)](https://ap-south-1.console.aws.amazon.com/s3/fs/create?region=ap-south-1&bucket=api-survey-app) and use:

| Setting             | Value                                                                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bucket name         | `api-survey-app`                                                                                                                                                            |
| AWS Region          | Asia Pacific (Mumbai) `ap-south-1`                                                                                                                                          |
| Object Ownership    | **ACLs disabled** (Bucket owner enforced)                                                                                                                                   |
| Block Public Access | Uncheck **only** “Block public access to buckets and objects granted through new public bucket or access point policies” (and acknowledge). Keep ACL-related blocks **on**. |
| Default encryption  | SSE-S3 (AES-256)                                                                                                                                                            |
| Bucket Versioning   | Off                                                                                                                                                                         |

Create the bucket.

### 2. Bucket policy (public read for `uploads/*` only)

Bucket → **Permissions** → **Bucket policy** → Edit → paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadSurveyUploads",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::api-survey-app/uploads/*"
    }
  ]
}
```

Save. CORS is not required (API uploads via Multer server-side).

### 3. IAM user + access keys

1. [IAM → Users → Create user](https://console.aws.amazon.com/iam/home#/users$new?step=details) named `api-survey-app-s3`.
2. Attach permissions → **Inline policy** → JSON:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SurveyPhotoObjects",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::api-survey-app/uploads/*"
    },
    {
      "Sid": "ListBucketOptional",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::api-survey-app",
      "Condition": {
        "StringLike": { "s3:prefix": ["uploads/*"] }
      }
    }
  ]
}
```

3. User → **Security credentials** → **Create access key** → choose **Application running outside AWS** → copy both values once.

## API environment

Paste the access key into the **repo root** `.env` (and Dokploy / production secrets):

```env
AWS_ACCESS_KEY_ID=<Access key ID>
AWS_SECRET_ACCESS_KEY=<Secret access key>
AWS_REGION=ap-south-1
AWS_S3_BUCKET=api-survey-app
AWS_S3_PUBLIC_URL=
AWS_S3_MAX_FILE_SIZE_BYTES=5242880
```

Leave `AWS_S3_PUBLIC_URL` empty unless you add CloudFront later (then set it to the distribution base URL, no trailing slash).

Local setup uses one file: `cp .env.example .env` at the monorepo root (API, web, Prisma, and Compose all read it). Optional overrides go in `.env.local`.

Public object URLs look like:

`https://api-survey-app.s3.ap-south-1.amazonaws.com/uploads/...`

## Verify

1. Restart the API — log must **not** say `AWS S3 is not fully configured`.
2. `POST /photos/upload` (auth + `file`, `surveyId`, `photoType`).
3. Open the returned `url` in a browser — image should load.
4. `DELETE /photos/:id` — object removed from S3.
