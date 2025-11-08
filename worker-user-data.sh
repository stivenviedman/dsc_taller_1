#!/bin/bash
# Configure credentials for CloudWatch agent
export AWS_ACCESS_KEY_ID=""
export AWS_SECRET_ACCESS_KEY="+h"
export AWS_SESSION_TOKEN=""
export AWS_REGION=""

sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 \
  -c file:/opt/aws/amazon-cloudwatch-agent/bin/config.json \
  -s

# Finally run your container
sudo docker run -d \
  --name new-worker \
  --restart unless-stopped \
  -e AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
  -e AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
  -e AWS_SESSION_TOKEN="$AWS_SESSION_TOKEN" \
  -e AWS_REGION="$AWS_REGION" \
  my-worker
