---
title: 'AWS ALB WebSocket: Config, Sticky Sessions & Scaling'
description:
  'Configure AWS Application Load Balancer for WebSockets. Covers target groups,
  sticky sessions, health checks, CloudFormation/CDK templates, monitoring, and
  cost optimization.'
author: Matthew O'Riordan
authorRole: Co-founder & CEO, Ably
publishedDate: 2025-09-01T00:00:00.000Z
updatedDate: 2025-09-01T00:00:00.000Z
lastUpdated: 2026-03-10
category: infrastructure
keywords:
  - aws alb websocket
  - aws websocket load balancer
  - alb sticky sessions websocket
  - aws websocket configuration
tags:
  - aws
  - alb
  - websocket
  - load-balancer
  - cloudformation
  - infrastructure
  - monitoring
seo:
  keywords:
    - aws alb websocket
    - application load balancer websocket
    - aws websocket configuration
    - alb sticky sessions
    - cloudformation websocket
    - aws websocket cost
    - alb target group websocket
    - aws websocket scaling
faq:
  - q: 'Does AWS ALB support WebSockets?'
    a:
      'Yes. AWS Application Load Balancer natively supports WebSockets. It
      automatically detects the HTTP Upgrade header and upgrades connections to
      WebSocket without additional configuration. Use target groups with HTTP
      protocol.'
  - q: 'How do I configure sticky sessions for WebSockets on ALB?'
    a:
      'Enable sticky sessions on your target group using application-based
      cookies or duration-based stickiness. This ensures reconnecting WebSocket
      clients reach the same backend instance, which is important for stateful
      connections.'
  - q: 'What is the ALB idle timeout for WebSockets?'
    a:
      'The default ALB idle timeout is 60 seconds. For WebSocket connections,
      increase this to match your application needs (up to 4000 seconds). Set it
      in the load balancer attributes or via CloudFormation/CDK.'
  - q: 'How do I monitor WebSocket connections on AWS ALB?'
    a:
      'Use CloudWatch metrics like ActiveConnectionCount, NewConnectionCount,
      and TargetResponseTime. Set alarms on connection errors and unhealthy host
      counts. Enable access logs for detailed connection-level analysis.'
date: '2024-09-02'
---

:::note[Quick Answer] AWS ALB supports WebSockets natively - no special
configuration needed. Set the idle timeout higher than 60s for long-lived
connections, enable sticky sessions on the target group, and configure health
checks on your WebSocket endpoint. :::

AWS Application Load Balancer (ALB) provides native WebSocket support with
automatic connection upgrades, making it an excellent choice for WebSocket
applications in AWS. This guide covers production configuration, monitoring, and
cost optimization.

## Quick Start

ALB automatically detects and upgrades WebSocket connections when it sees the
appropriate headers:

```yaml
# Basic CloudFormation template for WebSocket ALB
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  WebSocketALB:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Type: application
      Scheme: internet-facing
      SecurityGroups:
        - !Ref ALBSecurityGroup
      Subnets:
        - !Ref PublicSubnet1
        - !Ref PublicSubnet2

  WebSocketTargetGroup:
    Type: AWS::ElasticLoadBalancingV2::TargetGroup
    Properties:
      Port: 8080
      Protocol: HTTP
      TargetType: instance
      HealthCheckPath: /health
      HealthCheckIntervalSeconds: 30
      Matcher:
        HttpCode: 200

  WebSocketListener:
    Type: AWS::ElasticLoadBalancingV2::Listener
    Properties:
      LoadBalancerArn: !Ref WebSocketALB
      Port: 80
      Protocol: HTTP
      DefaultActions:
        - Type: forward
          TargetGroupArn: !Ref WebSocketTargetGroup
```

## WebSocket Support Details

### Automatic Protocol Detection

ALB automatically handles WebSocket connections without special configuration:

- Detects HTTP upgrade requests with `Upgrade: websocket` header
- Maintains the connection upgrade throughout the session
- Supports both WS (port 80) and WSS (port 443) protocols
- No special listener rules required for basic WebSocket support

### Connection Limits

- Maximum idle timeout: 4000 seconds (66 minutes)
- Default idle timeout: 60 seconds
- Maximum connections: Varies by instance type
- WebSocket frame size: Up to 128 KB per frame

## Target Group Configuration

### Basic Target Group Setup

```yaml
WebSocketTargetGroup:
  Type: AWS::ElasticLoadBalancingV2::TargetGroup
  Properties:
    Name: websocket-targets
    Port: 8080
    Protocol: HTTP
    VpcId: !Ref VPC
    TargetType: instance # or 'ip' for Fargate

    # Health check configuration
    HealthCheckEnabled: true
    HealthCheckPath: /health
    HealthCheckProtocol: HTTP
    HealthCheckIntervalSeconds: 30
    HealthCheckTimeoutSeconds: 5
    HealthyThresholdCount: 2
    UnhealthyThresholdCount: 3
    Matcher:
      HttpCode: 200-299

    # Target group attributes
    TargetGroupAttributes:
      - Key: deregistration_delay.timeout_seconds
        Value: 30
      - Key: stickiness.enabled
        Value: true
      - Key: stickiness.type
        Value: app_cookie
      - Key: stickiness.app_cookie.duration_seconds
        Value: 86400
      - Key: stickiness.app_cookie.cookie_name
        Value: WEBSOCKET_SESSION
```

### Sticky Sessions Configuration

WebSocket connections typically require session affinity:

```yaml
TargetGroupAttributes:
  # Application-based cookie stickiness (recommended)
  - Key: stickiness.enabled
    Value: true
  - Key: stickiness.type
    Value: app_cookie
  - Key: stickiness.app_cookie.cookie_name
    Value: WEBSOCKET_SESSION
  - Key: stickiness.app_cookie.duration_seconds
    Value: 86400 # 24 hours


  # Alternative: Duration-based cookie stickiness
  # - Key: stickiness.type
  #   Value: lb_cookie
  # - Key: stickiness.lb_cookie.duration_seconds
  #   Value: 86400
```

### Connection Draining

Configure graceful connection termination:

```yaml
TargetGroupAttributes:
  # Connection draining timeout
  - Key: deregistration_delay.timeout_seconds
    Value: 300 # 5 minutes for WebSocket connections

  # Connection draining for Lambda targets
  - Key: lambda.multi_value_headers.enabled
    Value: false
```

## Health Check Configuration

### WebSocket-Aware Health Checks

```yaml
HealthCheckConfiguration:
  Type: AWS::CloudFormation::CustomResource
  Properties:
    HealthCheckEnabled: true
    HealthCheckPath: /health
    HealthCheckProtocol: HTTP
    HealthCheckPort: traffic-port
    HealthCheckIntervalSeconds: 30
    HealthCheckTimeoutSeconds: 5
    HealthyThresholdCount: 2
    UnhealthyThresholdCount: 3
    Matcher:
      HttpCode: 200
```

### Custom Health Check Endpoint

Implement a health check that validates WebSocket capability:

```javascript
// Node.js health check endpoint example
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    websocket: {
      ready: wsServer.readyState === 1,
      connections: wsServer.clients.size,
      maxConnections: 10000,
    },
    system: {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
    },
  };

  // Return 503 if WebSocket server not ready
  const statusCode = health.websocket.ready ? 200 : 503;
  res.status(statusCode).json(health);
});
```

## Timeout Configuration

### ALB Timeout Settings

```yaml
LoadBalancerAttributes:
  - Key: idle_timeout.timeout_seconds
    Value: 4000 # Maximum for WebSocket connections

  - Key: routing.http2.enabled
    Value: true # Enable HTTP/2 support

  - Key: access_logs.s3.enabled
    Value: true

  - Key: access_logs.s3.bucket
    Value: !Ref LogBucket

  - Key: access_logs.s3.prefix
    Value: alb-logs
```

### Target Response Timeout

Configure appropriate timeouts for long-lived connections:

```yaml
TargetGroupAttributes:
  # Slow start for gradual traffic increase
  - Key: slow_start.duration_seconds
    Value: 30

  # Load balancing algorithm
  - Key: load_balancing.algorithm.type
    Value: round_robin # or 'least_outstanding_requests'
```

## SSL/TLS Configuration

### HTTPS Listener with SSL Certificate

```yaml
HTTPSListener:
  Type: AWS::ElasticLoadBalancingV2::Listener
  Properties:
    LoadBalancerArn: !Ref WebSocketALB
    Port: 443
    Protocol: HTTPS
    Certificates:
      - CertificateArn: !Ref Certificate
    SslPolicy: ELBSecurityPolicy-TLS-1-2-2017-01
    DefaultActions:
      - Type: forward
        TargetGroupArn: !Ref WebSocketTargetGroup

Certificate:
  Type: AWS::CertificateManager::Certificate
  Properties:
    DomainName: ws.example.com
    SubjectAlternativeNames:
      - '*.ws.example.com'
    ValidationMethod: DNS
    DomainValidationOptions:
      - DomainName: ws.example.com
        HostedZoneId: !Ref HostedZone
```

### Security Policy Selection

Choose appropriate SSL/TLS policies:

```yaml
SslPolicy: ELBSecurityPolicy-TLS13-1-2-2021-06 # Latest with TLS 1.3
# Alternative policies:
# ELBSecurityPolicy-TLS-1-2-2017-01  # TLS 1.2 only
# ELBSecurityPolicy-TLS-1-2-Ext-2018-06  # TLS 1.2 with additional ciphers
# ELBSecurityPolicy-FS-1-2-Res-2020-10  # Forward secrecy, TLS 1.2+
```

## Complete CloudFormation Template

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Production-ready WebSocket ALB Configuration'

Parameters:
  VPCId:
    Type: AWS::EC2::VPC::Id
    Description: VPC for the ALB

  SubnetIds:
    Type: List<AWS::EC2::Subnet::Id>
    Description: Public subnets for ALB (minimum 2)

  CertificateArn:
    Type: String
    Description: ACM Certificate ARN for HTTPS

  InstanceIds:
    Type: CommaDelimitedList
    Description: EC2 instance IDs for targets

Resources:
  # Security Group
  ALBSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group for WebSocket ALB
      VpcId: !Ref VPCId
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          CidrIp: 0.0.0.0/0
        - IpProtocol: tcp
          FromPort: 443
          ToPort: 443
          CidrIp: 0.0.0.0/0
      SecurityGroupEgress:
        - IpProtocol: -1
          CidrIp: 0.0.0.0/0
      Tags:
        - Key: Name
          Value: websocket-alb-sg

  # Application Load Balancer
  WebSocketALB:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Name: websocket-alb
      Type: application
      Scheme: internet-facing
      IpAddressType: ipv4
      SecurityGroups:
        - !Ref ALBSecurityGroup
      Subnets: !Ref SubnetIds
      LoadBalancerAttributes:
        - Key: idle_timeout.timeout_seconds
          Value: 4000
        - Key: routing.http2.enabled
          Value: true
        - Key: access_logs.s3.enabled
          Value: true
        - Key: access_logs.s3.bucket
          Value: !Ref LogBucket
        - Key: access_logs.s3.prefix
          Value: alb-logs
        - Key: deletion_protection.enabled
          Value: true
      Tags:
        - Key: Name
          Value: websocket-alb
        - Key: Environment
          Value: production

  # S3 Bucket for Logs
  LogBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub 'websocket-alb-logs-${AWS::AccountId}'
      BucketEncryption:
        ServerSideEncryptionConfiguration:
          - ServerSideEncryptionByDefault:
              SSEAlgorithm: AES256
      LifecycleConfiguration:
        Rules:
          - Id: DeleteOldLogs
            Status: Enabled
            ExpirationInDays: 90
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        BlockPublicPolicy: true
        IgnorePublicAcls: true
        RestrictPublicBuckets: true

  # Target Group
  WebSocketTargetGroup:
    Type: AWS::ElasticLoadBalancingV2::TargetGroup
    Properties:
      Name: websocket-targets
      Port: 8080
      Protocol: HTTP
      VpcId: !Ref VPCId
      TargetType: instance
      HealthCheckEnabled: true
      HealthCheckPath: /health
      HealthCheckProtocol: HTTP
      HealthCheckIntervalSeconds: 30
      HealthCheckTimeoutSeconds: 5
      HealthyThresholdCount: 2
      UnhealthyThresholdCount: 3
      Matcher:
        HttpCode: 200-299
      TargetGroupAttributes:
        - Key: deregistration_delay.timeout_seconds
          Value: 300
        - Key: stickiness.enabled
          Value: true
        - Key: stickiness.type
          Value: app_cookie
        - Key: stickiness.app_cookie.duration_seconds
          Value: 86400
        - Key: stickiness.app_cookie.cookie_name
          Value: WEBSOCKET_SESSION
        - Key: slow_start.duration_seconds
          Value: 30
        - Key: load_balancing.algorithm.type
          Value: least_outstanding_requests
      Targets:
        - Id: !Select [0, !Ref InstanceIds]
          Port: 8080
        - Id: !Select [1, !Ref InstanceIds]
          Port: 8080
      Tags:
        - Key: Name
          Value: websocket-target-group

  # HTTP Listener (redirects to HTTPS)
  HTTPListener:
    Type: AWS::ElasticLoadBalancingV2::Listener
    Properties:
      LoadBalancerArn: !Ref WebSocketALB
      Port: 80
      Protocol: HTTP
      DefaultActions:
        - Type: redirect
          RedirectConfig:
            Protocol: HTTPS
            Port: 443
            StatusCode: HTTP_301

  # HTTPS Listener
  HTTPSListener:
    Type: AWS::ElasticLoadBalancingV2::Listener
    Properties:
      LoadBalancerArn: !Ref WebSocketALB
      Port: 443
      Protocol: HTTPS
      Certificates:
        - CertificateArn: !Ref CertificateArn
      SslPolicy: ELBSecurityPolicy-TLS13-1-2-2021-06
      DefaultActions:
        - Type: forward
          TargetGroupArn: !Ref WebSocketTargetGroup

  # CloudWatch Alarms
  HighConnectionCount:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: !Sub '${AWS::StackName}-high-connections'
      AlarmDescription: Alert when connection count is high
      MetricName: ActiveConnectionCount
      Namespace: AWS/ApplicationELB
      Statistic: Sum
      Period: 300
      EvaluationPeriods: 2
      Threshold: 10000
      ComparisonOperator: GreaterThanThreshold
      Dimensions:
        - Name: LoadBalancer
          Value: !GetAtt WebSocketALB.LoadBalancerFullName

  UnhealthyTargets:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: !Sub '${AWS::StackName}-unhealthy-targets'
      AlarmDescription: Alert when targets are unhealthy
      MetricName: UnHealthyHostCount
      Namespace: AWS/ApplicationELB
      Statistic: Average
      Period: 300
      EvaluationPeriods: 2
      Threshold: 1
      ComparisonOperator: GreaterThanOrEqualToThreshold
      Dimensions:
        - Name: TargetGroup
          Value: !GetAtt WebSocketTargetGroup.TargetGroupFullName
        - Name: LoadBalancer
          Value: !GetAtt WebSocketALB.LoadBalancerFullName

Outputs:
  LoadBalancerDNS:
    Description: DNS name of the load balancer
    Value: !GetAtt WebSocketALB.DNSName
    Export:
      Name: !Sub '${AWS::StackName}-dns'

  LoadBalancerArn:
    Description: ARN of the load balancer
    Value: !Ref WebSocketALB
    Export:
      Name: !Sub '${AWS::StackName}-arn'

  TargetGroupArn:
    Description: ARN of the target group
    Value: !Ref WebSocketTargetGroup
    Export:
      Name: !Sub '${AWS::StackName}-target-group'
```

## AWS CDK Implementation

TypeScript CDK example for WebSocket ALB:

```typescript
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

export class WebSocketALBStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, 'WebSocketVPC', {
      maxAzs: 2,
      natGateways: 1,
    });

    // Security Group
    const albSecurityGroup = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc,
      description: 'Security group for WebSocket ALB',
      allowAllOutbound: true,
    });

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP traffic'
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS traffic'
    );

    // Application Load Balancer
    const alb = new elbv2.ApplicationLoadBalancer(this, 'WebSocketALB', {
      vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
      idleTimeout: cdk.Duration.seconds(4000),
      http2Enabled: true,
      deletionProtection: true,
    });

    // Certificate
    const certificate = new acm.Certificate(this, 'Certificate', {
      domainName: 'ws.example.com',
      subjectAlternativeNames: ['*.ws.example.com'],
      validation: acm.CertificateValidation.fromDns(),
    });

    // Target Group
    const targetGroup = new elbv2.ApplicationTargetGroup(
      this,
      'WebSocketTargets',
      {
        vpc,
        port: 8080,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targetType: elbv2.TargetType.INSTANCE,
        healthCheck: {
          path: '/health',
          interval: cdk.Duration.seconds(30),
          timeout: cdk.Duration.seconds(5),
          healthyThresholdCount: 2,
          unhealthyThresholdCount: 3,
          healthyHttpCodes: '200-299',
        },
        deregistrationDelay: cdk.Duration.seconds(300),
        stickinessCookieDuration: cdk.Duration.days(1),
        stickinessCookieName: 'WEBSOCKET_SESSION',
        slowStart: cdk.Duration.seconds(30),
        loadBalancingAlgorithmType:
          elbv2.TargetGroupLoadBalancingAlgorithmType
            .LEAST_OUTSTANDING_REQUESTS,
      }
    );

    // HTTPS Listener
    const httpsListener = alb.addListener('HTTPSListener', {
      port: 443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      certificates: [certificate],
      sslPolicy: elbv2.SslPolicy.TLS13_12,
    });

    httpsListener.addTargetGroups('WebSocketTargets', {
      targetGroups: [targetGroup],
    });

    // HTTP Listener (redirect to HTTPS)
    alb.addListener('HTTPListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.redirect({
        port: '443',
        protocol: elbv2.ApplicationProtocol.HTTPS,
        permanent: true,
      }),
    });

    // CloudWatch Alarms
    new cloudwatch.Alarm(this, 'HighConnectionCount', {
      metric: alb.metricActiveConnectionCount(),
      threshold: 10000,
      evaluationPeriods: 2,
      alarmDescription: 'Alert when connection count is high',
    });

    new cloudwatch.Alarm(this, 'UnhealthyTargets', {
      metric: targetGroup.metricUnhealthyHostCount(),
      threshold: 1,
      evaluationPeriods: 2,
      alarmDescription: 'Alert when targets are unhealthy',
    });

    // Outputs
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: alb.loadBalancerDnsName,
      description: 'DNS name of the load balancer',
    });
  }
}
```

## Monitoring and CloudWatch Metrics

### Key Metrics to Monitor

```yaml
WebSocketDashboard:
  Type: AWS::CloudWatch::Dashboard
  Properties:
    DashboardName: websocket-alb-dashboard
    DashboardBody: !Sub |
      {
        "widgets": [
          {
            "type": "metric",
            "properties": {
              "metrics": [
                ["AWS/ApplicationELB", "ActiveConnectionCount", {"stat": "Sum"}],
                [".", "NewConnectionCount", {"stat": "Sum"}],
                [".", "ClientTLSNegotiationErrorCount", {"stat": "Sum"}],
                [".", "TargetConnectionErrorCount", {"stat": "Sum"}]
              ],
              "period": 300,
              "stat": "Average",
              "region": "${AWS::Region}",
              "title": "WebSocket Connections"
            }
          },
          {
            "type": "metric",
            "properties": {
              "metrics": [
                ["AWS/ApplicationELB", "TargetResponseTime", {"stat": "Average"}],
                [".", "TargetResponseTime", {"stat": "p99"}],
                [".", "TargetResponseTime", {"stat": "p95"}]
              ],
              "period": 300,
              "stat": "Average",
              "region": "${AWS::Region}",
              "title": "Response Times"
            }
          }
        ]
      }
```

### Custom Metrics

Publish custom WebSocket metrics:

```javascript
// Node.js example using AWS SDK
const AWS = require('aws-sdk');
const cloudwatch = new AWS.CloudWatch();

function publishWebSocketMetrics(wsServer) {
  const params = {
    Namespace: 'WebSocket/Application',
    MetricData: [
      {
        MetricName: 'ConnectedClients',
        Value: wsServer.clients.size,
        Unit: 'Count',
        Timestamp: new Date(),
      },
      {
        MetricName: 'MessageRate',
        Value: wsServer.messageRate,
        Unit: 'Count/Second',
        Timestamp: new Date(),
      },
      {
        MetricName: 'ConnectionErrors',
        Value: wsServer.errorCount,
        Unit: 'Count',
        Timestamp: new Date(),
      },
    ],
  };

  cloudwatch.putMetricData(params, (err, data) => {
    if (err) console.error('CloudWatch error:', err);
  });
}

// Publish metrics every minute
setInterval(() => publishWebSocketMetrics(wsServer), 60000);
```

## Cost Optimization

### Understanding ALB Pricing

ALB costs consist of:

1. **Hourly charge**: ~$0.0225 per hour
2. **LCU (Load Balancer Capacity Units)**: ~$0.008 per LCU-hour

LCU dimensions for WebSocket:

- New connections: 25 per second
- Active connections: 3,000 per minute
- Processed bytes: 1 GB per hour
- Rule evaluations: 1,000 per second

### Cost Calculation Example

```javascript
// WebSocket cost calculator
function calculateALBCost(config) {
  const hoursPerMonth = 730;
  const hourlyCharge = 0.0225;
  const lcuPrice = 0.008;

  // Calculate LCU usage
  const connectionLCU = config.avgNewConnections / 25;
  const activeLCU = config.avgActiveConnections / 3000;
  const bytesLCU = config.gbPerHour / 1;
  const rulesLCU = config.rulesPerSecond / 1000;

  // Use highest dimension
  const maxLCU = Math.max(connectionLCU, activeLCU, bytesLCU, rulesLCU);

  // Monthly costs
  const fixedCost = hourlyCharge * hoursPerMonth;
  const variableCost = lcuPrice * maxLCU * hoursPerMonth;

  return {
    fixed: fixedCost,
    variable: variableCost,
    total: fixedCost + variableCost,
    dominantDimension: getDominantDimension(
      connectionLCU,
      activeLCU,
      bytesLCU,
      rulesLCU
    ),
  };
}

// Example: 5,000 concurrent WebSocket connections
const cost = calculateALBCost({
  avgNewConnections: 10, // 10 new connections/second
  avgActiveConnections: 5000, // 5,000 concurrent connections
  gbPerHour: 0.5, // 500 MB/hour data transfer
  rulesPerSecond: 100, // 100 rule evaluations/second
});

console.log(`Monthly ALB cost: $${cost.total.toFixed(2)}`);
console.log(`Dominant dimension: ${cost.dominantDimension}`);
```

### Cost Optimization Strategies

1. **Connection Pooling**: Reuse connections to reduce new connection rate
2. **Message Batching**: Combine multiple small messages
3. **Compression**: Reduce data transfer with message compression
4. **Idle Connection Management**: Close idle connections promptly
5. **Regional Deployment**: Deploy in regions with lower pricing

## Troubleshooting

### Common Issues and Solutions

1. **502 Bad Gateway Errors**

```bash
# Check target health
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:region:account:targetgroup/name

# Review ALB access logs
aws s3 cp s3://bucket/prefix/AWSLogs/account/elasticloadbalancing/region/2024/01/01/ . --recursive
```

1. **Connection Timeouts**

```bash
# Verify idle timeout setting
aws elbv2 describe-load-balancer-attributes \
  --load-balancer-arn arn:aws:elasticloadbalancing:region:account:loadbalancer/app/name

# Update timeout (max 4000 seconds)
aws elbv2 modify-load-balancer-attributes \
  --load-balancer-arn arn:aws:elasticloadbalancing:region:account:loadbalancer/app/name \
  --attributes Key=idle_timeout.timeout_seconds,Value=4000
```

1. **Sticky Session Issues**

```bash
# Verify stickiness configuration
aws elbv2 describe-target-group-attributes \
  --target-group-arn arn:aws:elasticloadbalancing:region:account:targetgroup/name

# Enable app cookie stickiness
aws elbv2 modify-target-group-attributes \
  --target-group-arn arn:aws:elasticloadbalancing:region:account:targetgroup/name \
  --attributes \
    Key=stickiness.enabled,Value=true \
    Key=stickiness.type,Value=app_cookie \
    Key=stickiness.app_cookie.cookie_name,Value=WEBSOCKET_SESSION \
    Key=stickiness.app_cookie.duration_seconds,Value=86400
```

### Access Log Analysis

Parse ALB logs for WebSocket connections:

```python
import re
import gzip
from datetime import datetime

def parse_alb_log(log_line):
    # ALB log format regex
    pattern = r'([^ ]*) ([^ ]*) ([^ ]*) ([^ ]*):([0-9]*) ([^ ]*)[:-]([0-9]*) ([-.0-9]*) ([-.0-9]*) ([-.0-9]*) (|[-0-9]*) (-|[-0-9]*) ([-0-9]*) ([-0-9]*) \"([^ ]*) ([^ ]*) (- |[^ ]*)\" \"([^\"]*)\" ([A-Z0-9-]+) ([A-Za-z0-9.-]*) ([^ ]*) \"([^\"]*)\" \"([^\"]*)\" \"([^\"]*)\" ([-.0-9]*) ([^ ]*) \"([^\"]*)\"($| \"([^ ]*)\").*'

    match = re.match(pattern, log_line)
    if match:
        return {
            'timestamp': match.group(1),
            'client': match.group(3),
            'target': match.group(5),
            'request_processing_time': float(match.group(8)),
            'target_processing_time': float(match.group(9)),
            'response_processing_time': float(match.group(10)),
            'elb_status_code': match.group(11),
            'target_status_code': match.group(12),
            'method': match.group(15),
            'url': match.group(16),
            'protocol': match.group(17),
            'user_agent': match.group(19),
            'ssl_cipher': match.group(20),
            'ssl_protocol': match.group(21)
        }
    return None

# Analyze WebSocket upgrade requests
def analyze_websocket_logs(log_file):
    websocket_requests = []

    with gzip.open(log_file, 'rt') as f:
        for line in f:
            log_entry = parse_alb_log(line)
            if log_entry and 'upgrade' in log_entry.get('url', '').lower():
                websocket_requests.append(log_entry)

    return websocket_requests
```

## Best Practices

1. **Enable Deletion Protection**: Prevent accidental deletion in production
2. **Use Multiple Availability Zones**: Deploy ALB across at least 2 AZs
3. **Implement Health Checks**: Create WebSocket-aware health endpoints
4. **Enable Access Logs**: Store logs in S3 for analysis
5. **Set Appropriate Timeouts**: Use maximum timeout for long-lived connections
6. **Configure Sticky Sessions**: Ensure connection affinity for stateful
   applications
7. **Monitor Key Metrics**: Track connections, errors, and response times
8. **Implement Connection Draining**: Allow graceful shutdown with appropriate
   delays
9. **Use SSL/TLS**: Always use WSS in production with proper certificates
10. **Tag Resources**: Use consistent tagging for cost allocation and management

## Frequently Asked Questions

### Does AWS ALB support WebSockets?

Yes. AWS Application Load Balancer natively supports WebSockets. It
automatically detects the HTTP Upgrade header and upgrades connections to
WebSocket without additional configuration. Use target groups with HTTP
protocol.

### How do I configure sticky sessions for WebSockets on ALB?

Enable sticky sessions on your target group using application-based cookies or
duration-based stickiness. This ensures reconnecting WebSocket clients reach the
same backend instance, which is important for stateful connections.

### What is the ALB idle timeout for WebSockets?

The default ALB idle timeout is 60 seconds. For WebSocket connections, increase
this to match your application needs (up to 4000 seconds). Set it in the load
balancer attributes or via CloudFormation/CDK.

### How do I monitor WebSocket connections on AWS ALB?

Use CloudWatch metrics like ActiveConnectionCount, NewConnectionCount, and
TargetResponseTime. Set alarms on connection errors and unhealthy host counts.
Enable access logs for detailed connection-level analysis.

## Additional Resources

- [AWS ALB Documentation](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/)
- [ALB WebSocket Support](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-websockets.html)
- [ALB Pricing](https://aws.amazon.com/elasticloadbalancing/pricing/)
- [CloudFormation ALB Resources](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-elasticloadbalancingv2-loadbalancer.html)

## Related Content

- [Nginx WebSocket Proxy](/guides/infrastructure/nginx/) - Alternative reverse
  proxy configuration
- [Kubernetes WebSocket Ingress](/guides/infrastructure/kubernetes/) - Container
  orchestration with NGINX and Traefik Ingress
- [Cloudflare WebSockets](/guides/infrastructure/cloudflare/) - CDN and edge
  WebSocket support
- [WebSockets at Scale](/guides/websockets-at-scale/) - Architecture patterns
  for millions of connections
- [WebSocket Security](/guides/security/) - TLS termination and authentication
  strategies
