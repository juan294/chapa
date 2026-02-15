# Email Forwarding Setup: AWS SES + Resend + Lambda

Reusable guide for setting up `support@<domain>` email forwarding to Gmail using AWS SES (inbound), S3 (archive), Lambda (processing), and Resend (outbound forwarding).

**Architecture:**

```
Sender → support@yourdomain.com
  → MX record → AWS SES inbound SMTP (us-east-1)
  → SES receipt rule
      → Action 1: Save raw email to S3 (archive)
      → Action 2: Invoke Lambda (async)
  → Lambda reads email from S3
  → Lambda parses email (mailparser)
  → Lambda calls Resend API to forward
  → Gmail inbox
```

---

## Prerequisites

- **AWS account** with CLI access (`aws configure --profile <profile>`)
- **Resend account** at [resend.com](https://resend.com) with an API key
- **Domain** with DNS access (to add MX, TXT, DKIM records)
- **Node.js** installed locally (for building the Lambda package)

## Variables reference

Throughout this guide, replace these placeholders with your actual values:

| Placeholder | Example | Description |
|-------------|---------|-------------|
| `<AWS_PROFILE>` | `paisaxe-project` | AWS CLI profile name |
| `<AWS_ACCOUNT_ID>` | `481665111394` | Your AWS account ID |
| `<DOMAIN>` | `chapa.thecreativetoken.com` | Your domain |
| `<SUPPORT_EMAIL>` | `support@chapa.thecreativetoken.com` | Inbound address to forward |
| `<FORWARD_TO>` | `juan294@gmail.com` | Gmail address to receive forwards |
| `<PROJECT>` | `chapa` | Short project name (used in resource names) |
| `<RESEND_API_KEY>` | `re_xxxxxxxx` | Resend API key |
| `<FROM_LABEL>` | `Chapa Support` | Display name on forwarded emails |

---

## Step 1: Resend domain setup

1. Go to [resend.com/domains](https://resend.com/domains) and click **Add Domain**.
2. Enter your domain (`<DOMAIN>`).
3. Select region **North Virginia (us-east-1)** — SES inbound only works in specific regions.
4. Resend will show DNS records you need to add. Add **all** of them to your DNS provider:

### Domain Verification (DKIM)

| Type | Name | Content |
|------|------|---------|
| TXT | `resend._domainkey.<DOMAIN>` | _(copy from Resend dashboard)_ |

### Enable Sending (SPF)

| Type | Name | Content |
|------|------|---------|
| MX | `send.<DOMAIN>` | `10 feedback-smtp-<region>.amazonses.com` |
| TXT | `send.<DOMAIN>` | `v=spf1 include:amazonses.com ~all` |

### Enable Receiving (MX)

| Type | Name | Content |
|------|------|---------|
| MX | `<DOMAIN>` | `10 inbound-smtp.us-east-1.amazonaws.com` |

5. Wait for all records to show **Verified** status in the Resend dashboard (usually 5–30 minutes).

> **Important:** The receiving MX record points emails to your AWS SES account. SES will handle inbound routing. Resend is used for outbound sending (the Lambda forwards emails through Resend's API).

---

## Step 2: Verify domain in AWS SES

Resend's domain setup automatically creates the SES identity and DKIM in your AWS account. Verify it:

```bash
aws ses get-identity-verification-attributes \
  --identities "<DOMAIN>" \
  --region us-east-1 \
  --profile <AWS_PROFILE>
```

Expected output: `"VerificationStatus": "Success"`

```bash
aws ses get-identity-dkim-attributes \
  --identities "<DOMAIN>" \
  --region us-east-1 \
  --profile <AWS_PROFILE>
```

Expected output: `"DkimEnabled": true, "DkimVerificationStatus": "Success"`

If the domain isn't verified, you may need to verify it manually:

```bash
aws ses verify-domain-identity \
  --domain "<DOMAIN>" \
  --region us-east-1 \
  --profile <AWS_PROFILE>
```

> **Note:** SES sandbox mode only restricts *sending*. Inbound email receiving works regardless of sandbox status.

---

## Step 3: Create S3 bucket for email archive

```bash
aws s3api create-bucket \
  --bucket <PROJECT>-ses-emails \
  --region us-east-1 \
  --profile <AWS_PROFILE>
```

Add a bucket policy allowing SES to write emails:

```bash
aws s3api put-bucket-policy \
  --bucket <PROJECT>-ses-emails \
  --profile <AWS_PROFILE> \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "AllowSESPuts",
        "Effect": "Allow",
        "Principal": {
          "Service": "ses.amazonaws.com"
        },
        "Action": "s3:PutObject",
        "Resource": "arn:aws:s3:::<PROJECT>-ses-emails/*",
        "Condition": {
          "StringEquals": {
            "AWS:SourceAccount": "<AWS_ACCOUNT_ID>"
          }
        }
      }
    ]
  }'
```

---

## Step 4: Create IAM role for Lambda

```bash
aws iam create-role \
  --role-name <PROJECT>-email-forwarder-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "lambda.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }' \
  --profile <AWS_PROFILE>
```

Attach an inline policy for S3 read access and CloudWatch logging:

```bash
aws iam put-role-policy \
  --role-name <PROJECT>-email-forwarder-role \
  --policy-name <PROJECT>-email-forwarder-policy \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": ["s3:GetObject"],
        "Resource": "arn:aws:s3:::<PROJECT>-ses-emails/*"
      },
      {
        "Effect": "Allow",
        "Action": [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        "Resource": "arn:aws:logs:us-east-1:<AWS_ACCOUNT_ID>:*"
      }
    ]
  }' \
  --profile <AWS_PROFILE>
```

---

## Step 5: Create the Lambda function

### 5a. Write the Lambda code

Create a working directory and the function code:

```bash
mkdir -p /tmp/<PROJECT>-email-lambda
```

Create `/tmp/<PROJECT>-email-lambda/package.json`:

```json
{
  "name": "<PROJECT>-email-forwarder",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "mailparser": "^3.7.2"
  }
}
```

Create `/tmp/<PROJECT>-email-lambda/index.mjs`:

```javascript
/**
 * AWS Lambda — SES inbound email forwarder.
 *
 * Flow: SES receipt rule → S3 (save) → Lambda (this) → Resend API → Gmail
 *
 * Environment variables:
 *   RESEND_API_KEY  — Resend API key (re_*)
 *   FORWARD_TO      — Gmail address to forward to
 *   S3_BUCKET       — S3 bucket where SES stores emails
 *   FROM_ADDRESS    — From address for forwarded emails
 */

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { simpleParser } from "mailparser";

const s3 = new S3Client({ region: "us-east-1" });

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FORWARD_TO = process.env.FORWARD_TO;
const S3_BUCKET = process.env.S3_BUCKET;
const FROM_ADDRESS = process.env.FROM_ADDRESS;

export async function handler(event) {
  console.log("SES event received:", JSON.stringify(event, null, 2));

  const sesRecord = event.Records?.[0]?.ses;
  if (!sesRecord) {
    console.error("No SES record in event");
    return { status: "error", message: "No SES record" };
  }

  const messageId = sesRecord.mail.messageId;
  const originalFrom = sesRecord.mail.commonHeaders?.from?.[0] || "unknown";
  const originalSubject =
    sesRecord.mail.commonHeaders?.subject || "(no subject)";

  console.log(
    `Processing: messageId=${messageId}, from=${originalFrom}, subject=${originalSubject}`
  );

  // 1. Read raw email from S3
  let rawEmail;
  try {
    const { Body } = await s3.send(
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: messageId })
    );
    rawEmail = await Body.transformToString();
  } catch (err) {
    console.error("Failed to read email from S3:", err.message);
    return { status: "error", message: "S3 read failed" };
  }

  // 2. Parse email with mailparser
  let parsed;
  try {
    parsed = await simpleParser(rawEmail);
  } catch (err) {
    console.error("Failed to parse email:", err.message);
    parsed = {
      from: { text: originalFrom },
      subject: originalSubject,
      text: rawEmail,
      html: null,
    };
  }

  const fromText = parsed.from?.text || originalFrom;
  const subject = parsed.subject || originalSubject;
  const textBody = parsed.text || "";
  const htmlBody = parsed.html || "";

  // 3. Build forwarded email content
  const forwardedHtml = htmlBody
    ? [
        '<div style="padding:12px 0;margin-bottom:16px;border-bottom:1px solid #ccc;color:#666;font-size:13px;">',
        "<strong>--- Forwarded message ---</strong><br/>",
        `From: ${escapeHtml(fromText)}<br/>`,
        `Subject: ${escapeHtml(subject)}`,
        "</div>",
        htmlBody,
      ].join("\n")
    : null;

  const forwardedText = [
    "--- Forwarded message ---",
    `From: ${fromText}`,
    `Subject: ${subject}`,
    "",
    textBody,
  ].join("\n");

  // 4. Forward via Resend API
  const payload = {
    from: FROM_ADDRESS,
    to: [FORWARD_TO],
    reply_to: fromText,
    subject: `Fwd: ${subject}`,
    text: forwardedText,
  };

  if (forwardedHtml) {
    payload.html = forwardedHtml;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", res.status, JSON.stringify(body));
      return { status: "error", message: "Resend send failed", detail: body };
    }

    console.log(`Email forwarded successfully: resendId=${body.id}`);
    return { status: "forwarded", resendId: body.id, messageId };
  } catch (err) {
    console.error("Resend API call failed:", err.message);
    return { status: "error", message: "Resend API call failed" };
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
```

### 5b. Install dependencies and package

```bash
cd /tmp/<PROJECT>-email-lambda
npm install --production
zip -r /tmp/<PROJECT>-email-lambda.zip . -x "package-lock.json" -x "package.json"
```

The zip should be ~1.4 MB.

### 5c. Deploy the Lambda

Wait ~10 seconds after creating the IAM role for it to propagate, then:

```bash
aws lambda create-function \
  --function-name <PROJECT>-email-forwarder \
  --runtime nodejs22.x \
  --handler index.handler \
  --role arn:aws:iam::<AWS_ACCOUNT_ID>:role/<PROJECT>-email-forwarder-role \
  --zip-file fileb:///tmp/<PROJECT>-email-lambda.zip \
  --timeout 30 \
  --memory-size 256 \
  --environment "Variables={
    RESEND_API_KEY=<RESEND_API_KEY>,
    FORWARD_TO=<FORWARD_TO>,
    S3_BUCKET=<PROJECT>-ses-emails,
    FROM_ADDRESS=<FROM_LABEL> <<SUPPORT_EMAIL>>
  }" \
  --region us-east-1 \
  --profile <AWS_PROFILE>
```

### 5d. Allow SES to invoke the Lambda

```bash
aws lambda add-permission \
  --function-name <PROJECT>-email-forwarder \
  --statement-id AllowSESInvoke \
  --action lambda:InvokeFunction \
  --principal ses.amazonaws.com \
  --source-account <AWS_ACCOUNT_ID> \
  --region us-east-1 \
  --profile <AWS_PROFILE>
```

---

## Step 6: Create SES receipt rules

> **Important:** Only ONE receipt rule set can be active per AWS region. If you have multiple projects sharing the same AWS account, add rules to the same rule set rather than creating separate ones.

### 6a. Create the receipt rule set (first project only)

```bash
aws ses create-receipt-rule-set \
  --rule-set-name <PROJECT>-email-rules \
  --region us-east-1 \
  --profile <AWS_PROFILE>
```

### 6b. Create a receipt rule

The rule has two sequential actions:
1. **S3 action** — archives the raw email
2. **Lambda action** — parses and forwards to Gmail

```bash
aws ses create-receipt-rule \
  --rule-set-name <PROJECT>-email-rules \
  --rule '{
    "Name": "<PROJECT>-support-forward",
    "Enabled": true,
    "Recipients": ["<SUPPORT_EMAIL>"],
    "Actions": [
      {
        "S3Action": {
          "BucketName": "<PROJECT>-ses-emails"
        }
      },
      {
        "LambdaAction": {
          "FunctionArn": "arn:aws:lambda:us-east-1:<AWS_ACCOUNT_ID>:function:<PROJECT>-email-forwarder",
          "InvocationType": "Event"
        }
      }
    ],
    "ScanEnabled": true,
    "TlsPolicy": "Optional"
  }' \
  --region us-east-1 \
  --profile <AWS_PROFILE>
```

**Adding a second project to an existing rule set:**

```bash
aws ses create-receipt-rule \
  --rule-set-name <EXISTING_RULE_SET> \
  --rule '{
    "Name": "<NEW_PROJECT>-support-forward",
    "Enabled": true,
    "Recipients": ["support@newdomain.com"],
    "Actions": [
      {
        "S3Action": {
          "BucketName": "<NEW_PROJECT>-ses-emails"
        }
      },
      {
        "LambdaAction": {
          "FunctionArn": "arn:aws:lambda:us-east-1:<AWS_ACCOUNT_ID>:function:<NEW_PROJECT>-email-forwarder",
          "InvocationType": "Event"
        }
      }
    ],
    "ScanEnabled": true,
    "TlsPolicy": "Optional"
  }' \
  --region us-east-1 \
  --profile <AWS_PROFILE>
```

### 6c. Activate the rule set

```bash
aws ses set-active-receipt-rule-set \
  --rule-set-name <PROJECT>-email-rules \
  --region us-east-1 \
  --profile <AWS_PROFILE>
```

---

## Step 7: Test the pipeline

Send a test email through SES:

```bash
aws ses send-email \
  --from "test@<DOMAIN>" \
  --destination "ToAddresses=<SUPPORT_EMAIL>" \
  --message "Subject={Data='Test: email forwarding pipeline'},Body={Text={Data='If you receive this at <FORWARD_TO>, the setup is complete.'}}" \
  --region us-east-1 \
  --profile <AWS_PROFILE>
```

### Verify each step

**Check S3 (email archived):**

```bash
aws s3 ls s3://<PROJECT>-ses-emails/ \
  --profile <AWS_PROFILE>
```

**Check Lambda logs (processed and forwarded):**

```bash
aws logs describe-log-streams \
  --log-group-name /aws/lambda/<PROJECT>-email-forwarder \
  --order-by LastEventTime --descending --limit 1 \
  --region us-east-1 \
  --profile <AWS_PROFILE>

# Then read the latest log stream:
aws logs get-log-events \
  --log-group-name /aws/lambda/<PROJECT>-email-forwarder \
  --log-stream-name '<LOG_STREAM_NAME>' \
  --region us-east-1 \
  --profile <AWS_PROFILE>
```

Look for: `Email forwarded successfully: resendId=<id>`

**Check Gmail:** You should receive the forwarded email at `<FORWARD_TO>`.

---

## Troubleshooting

### Email saved to S3 but Lambda not invoked

- Check that the Lambda permission allows SES to invoke it:
  ```bash
  aws lambda get-policy \
    --function-name <PROJECT>-email-forwarder \
    --region us-east-1 \
    --profile <AWS_PROFILE>
  ```
- The `InvocationType` must be `Event` (async). `RequestResponse` (sync) requires the Lambda to respond within 30 seconds or SES considers it failed.

### Lambda invoked but Resend API fails

- Check the `RESEND_API_KEY` env var is correct (no trailing whitespace).
- Ensure the domain is verified in Resend. The `from` address must use a verified domain.
- Check Resend dashboard at [resend.com/emails](https://resend.com/emails) for send attempts and errors.

### No email in S3

- Verify the receipt rule set is active:
  ```bash
  aws ses describe-active-receipt-rule-set \
    --region us-east-1 \
    --profile <AWS_PROFILE>
  ```
- Verify the MX record for `<DOMAIN>` points to `inbound-smtp.us-east-1.amazonaws.com`:
  ```bash
  dig MX <DOMAIN>
  ```
- Verify the S3 bucket policy allows SES to write:
  ```bash
  aws s3api get-bucket-policy \
    --bucket <PROJECT>-ses-emails \
    --profile <AWS_PROFILE>
  ```

### SES sandbox limitations

SES sandbox mode only restricts **sending**. Inbound receiving works regardless. But if you use `aws ses send-email` to test, the destination must also be a verified address. To test from an external sender (Gmail, etc.), just send a real email — no sandbox restriction applies to inbound.

Check sandbox status:
```bash
aws sesv2 get-account \
  --region us-east-1 \
  --profile <AWS_PROFILE> \
  --query "ProductionAccessEnabled"
```

---

## AWS resources inventory

After completing this guide, you will have created:

| Resource | Name pattern | Service |
|----------|-------------|---------|
| S3 bucket | `<PROJECT>-ses-emails` | S3 |
| S3 bucket policy | `AllowSESPuts` | S3 |
| IAM role | `<PROJECT>-email-forwarder-role` | IAM |
| IAM inline policy | `<PROJECT>-email-forwarder-policy` | IAM |
| Lambda function | `<PROJECT>-email-forwarder` | Lambda |
| Lambda permission | `AllowSESInvoke` | Lambda |
| SES receipt rule set | `<PROJECT>-email-rules` | SES |
| SES receipt rule | `<PROJECT>-support-forward` | SES |

---

## Current deployments

| Project | Support email | Forward to | Rule set | Lambda | S3 bucket |
|---------|-------------|------------|----------|--------|-----------|
| Chapa | `support@chapa.thecreativetoken.com` | `juan294@gmail.com` | `chapa-email-rules` | `chapa-email-forwarder` | `chapa-ses-emails` |

---

## Updating the Lambda code

If you need to update the Lambda function (e.g., change forwarding logic):

```bash
# Rebuild the zip
cd /tmp/<PROJECT>-email-lambda
zip -r /tmp/<PROJECT>-email-lambda.zip . -x "package-lock.json" -x "package.json"

# Deploy the update
aws lambda update-function-code \
  --function-name <PROJECT>-email-forwarder \
  --zip-file fileb:///tmp/<PROJECT>-email-lambda.zip \
  --region us-east-1 \
  --profile <AWS_PROFILE>
```

To update environment variables:

```bash
aws lambda update-function-configuration \
  --function-name <PROJECT>-email-forwarder \
  --environment "Variables={
    RESEND_API_KEY=<NEW_KEY>,
    FORWARD_TO=<NEW_EMAIL>,
    S3_BUCKET=<PROJECT>-ses-emails,
    FROM_ADDRESS=<FROM_LABEL> <<SUPPORT_EMAIL>>
  }" \
  --region us-east-1 \
  --profile <AWS_PROFILE>
```

---

## Cleanup (if removing a project)

```bash
# 1. Delete receipt rule
aws ses delete-receipt-rule \
  --rule-set-name <PROJECT>-email-rules \
  --rule-name <PROJECT>-support-forward \
  --region us-east-1 --profile <AWS_PROFILE>

# 2. Deactivate rule set (only if no other rules remain)
aws ses set-active-receipt-rule-set \
  --region us-east-1 --profile <AWS_PROFILE>

# 3. Delete rule set
aws ses delete-receipt-rule-set \
  --rule-set-name <PROJECT>-email-rules \
  --region us-east-1 --profile <AWS_PROFILE>

# 4. Delete Lambda
aws lambda delete-function \
  --function-name <PROJECT>-email-forwarder \
  --region us-east-1 --profile <AWS_PROFILE>

# 5. Delete IAM policy and role
aws iam delete-role-policy \
  --role-name <PROJECT>-email-forwarder-role \
  --policy-name <PROJECT>-email-forwarder-policy \
  --profile <AWS_PROFILE>

aws iam delete-role \
  --role-name <PROJECT>-email-forwarder-role \
  --profile <AWS_PROFILE>

# 6. Empty and delete S3 bucket
aws s3 rm s3://<PROJECT>-ses-emails --recursive --profile <AWS_PROFILE>
aws s3api delete-bucket --bucket <PROJECT>-ses-emails --profile <AWS_PROFILE>

# 7. Remove domain from Resend dashboard (optional)
# 8. Remove DNS records (MX, TXT, DKIM) from your domain provider
```
