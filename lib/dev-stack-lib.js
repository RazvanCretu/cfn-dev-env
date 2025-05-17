// const sqs = require('aws-cdk-lib/aws-sqs');
import { CfnOutput, Duration, Stack, TimeZone } from "aws-cdk-lib";
import {
  Vpc,
  IpAddresses,
  SubnetType,
  GatewayVpcEndpointAwsService,
  SecurityGroup,
  Peer,
  Port,
  Instance,
  InstanceType,
  InstanceClass,
  InstanceSize,
  MachineImage,
  KeyPair,
  CfnEIP,
  UserData,
  BlockDeviceVolume,
  EbsDeviceVolumeType,
  CfnInstance,
} from "aws-cdk-lib/aws-ec2";
import { Schedule, ScheduleExpression } from "aws-cdk-lib/aws-scheduler";
import { LambdaInvoke } from "aws-cdk-lib/aws-scheduler-targets";
import {
  AccountRootPrincipal,
  Effect,
  InstanceProfile,
  ManagedPolicy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  ObjectOwnership,
} from "aws-cdk-lib/aws-s3";
import { readFileSync } from "fs";

export class DevStack extends Stack {
  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const vpc = new Vpc(this, "VPC", {
      vpcName: "master-vpc",
      ipAddresses: IpAddresses.cidr("10.0.0.0/16"),
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 20,
          name: "Public-",
          subnetType: SubnetType.PUBLIC,
        },
        {
          cidrMask: 20,
          name: "Private-",
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
      ],
      gatewayEndpoints: {
        S3: {
          service: GatewayVpcEndpointAwsService.S3,
          subnets: [{ subnetType: SubnetType.PRIVATE_ISOLATED }],
        },
      },
    });

    const instancesRole = new Role(this, "InstancesFunctionRole", {
      roleName: "InstancesFunctionRole",
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName("CloudWatchFullAccess"),
        ManagedPolicy.fromAwsManagedPolicyName("AmazonEC2FullAccess"),
      ],
    });

    instancesRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        resources: ["*"],
        actions: ["iam:PassRole"],
      })
    );

    const instanceProfile = new Role(this, "MasterProfile", {
      roleName: "master-instance-profile",
      assumedBy: new ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess"),
        ManagedPolicy.fromAwsManagedPolicyName("AmazonEC2FullAccess"),
        ManagedPolicy.fromAwsManagedPolicyName("SecretsManagerReadWrite"),
        ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
        ManagedPolicy.fromManagedPolicyArn(
          this,
          "PatchPolicy",
          "arn:aws:iam::423577484048:policy/ssm/quicksetup/patchpolicy/aws-quicksetup-patchpolicy-baselineoverrides-s3"
        ),
      ],
    });

    const sg = new SecurityGroup(this, "SecurityGroup", {
      vpc,
      securityGroupName: "master-sg",
      description:
        "Security Group to use when accessing resources in this vpc from personal computer.",
    });

    sg.addIngressRule(
      Peer.ipv4(`${process.env.PERSONAL_IP}/32`),
      Port.tcp(22),
      "SSH from personal computer."
    );

    sg.addIngressRule(
      Peer.ipv4(`${process.env.PERSONAL_IP}/32`),
      Port.tcp(80),
      "HTTP from personal computer."
    );

    sg.addIngressRule(
      Peer.ipv4(`${process.env.PERSONAL_IP}/32`),
      Port.tcp(3389),
      "RDP from personal computer."
    );

    sg.addIngressRule(
      Peer.ipv4(`${process.env.ANDREI_IP}/32`),
      Port.tcp(3389),
      "RDP from personal computer."
    );

    const bucket = new Bucket(this, "GeneralBucket", {
      bucketName: "general-cr3tu",
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
      versioned: false,
    });

    bucket.grantReadWrite(new AccountRootPrincipal());

    const instance = new Instance(this, "Instance-Dev", {
      vpc,
      vpcSubnets: {
        // This is need in order for SubnetFilters to be able to find public Subnets
        subnetType: SubnetType.PUBLIC,
      },
      role: instanceProfile,
      securityGroup: sg,
      instanceName: "master",
      instanceType: InstanceType.of(InstanceClass.T3A, InstanceSize.LARGE),
      machineImage: MachineImage.genericLinux({
        "eu-central-1": "ami-0faab6bdbac9486fb",
      }),
      // This will trigger an Instance replacement. Use with caution !!!
      blockDevices: [
        {
          deviceName: "/dev/sda1",
          volume: BlockDeviceVolume.ebs(30, {
            volumeType: EbsDeviceVolumeType.GP3,
            iops: 3000,
          }),
        },
      ],
      requireImdsv2: true,
      // Create in AWS console before deploy
      keyPair: KeyPair.fromKeyPairName(
        this,
        "KeyPair",
        process.env.AWS_EC2_KEY
      ),
    });

    instance.addUserData(
      `curl '${process.env.AWS_EC2_USERDATA}' -o './bootstrap.sh' && sh ./bootstrap.sh && rm -rf ./bootstrap.sh`,
      `su - ubuntu -c "git config --global user.name '${process.env.GIT_USER}' && git config --global user.email '${process.env.GIT_EMAIL}'"`
    );

    new CfnEIP(this, "ElasticIP", { instanceId: instance.instanceId });

    const traderProfile = new InstanceProfile(this, "TraderProfile", {
      name: "Trader-Profile",
      role: instanceProfile,
    });

    const lambdaFn = new NodejsFunction(this, "TraderFn", {
      timeout: Duration.seconds(120),
      runtime: Runtime.NODEJS_20_X,
      entry: "src/trader/index.js", // Path to the lambda
      role: instancesRole,
      environment: {
        ADMIRALS_ACCOUNT: process.env.ADMIRALS_ACCOUNT,
        ADMIRALS_PASS: process.env.ADMIRALS_PASSWORD,
        PROFILE_ARN: traderProfile.instanceProfileArn,
        GH_TOKEN: process.env.GH_TOKEN,
      },
    });

    new Schedule(this, "Schedule", {
      target: new LambdaInvoke(lambdaFn),
      schedule: ScheduleExpression.cron({
        minute: "00",
        hour: "00",
        // day: "*",
        weekDay: "TUE-SAT",
        month: "*",
        year: "*",
        timeZone: TimeZone.EUROPE_BUCHAREST,
      }),
    });

    // const windows = new Instance(this, "Instance-Windows", {
    //   vpc,
    //   role: instanceProfile,
    //   securityGroup: sg,
    //   instanceName: "master-windows",
    //   instanceType: InstanceType.of(InstanceClass.T3A, InstanceSize.XLARGE),
    //   machineImage: MachineImage.genericWindows({
    //     "eu-central-1": "ami-08a270a75ca25e82a",
    //   }),
    //   requireImdsv2: true,
    //   keyPair: KeyPair.fromKeyPairName(
    //     this,
    //     "KeyPair-Windows",
    //     process.env.AWS_EC2_KEY
    //   ), // Create this in the console before deploying
    //   vpcSubnets: {
    //     subnetType: SubnetType.PUBLIC, // This is need in order for SubnetFilters to be able to find public Subnets
    //   },
    //   userData: UserData.custom(`
    //     <powershell>
    //     $env:ADMIRALS_ACCOUNT = "${process.env.ADMIRALS_ACCOUNT}"
    //     $env:ADMIRALS_PASS = "${process.env.ADMIRALS_PASSWORD}"
    //     $env:GH_TOKEN = "${process.env.GH_TOKEN}"
    //     Start-Transcript -Path "C:\\UserData.log" -Append
    //     ${readFileSync("bootstrap.ps1", { encoding: "utf-8" })}
    //     </powershell>
    //     `),
    // });
    // new CfnOutput(this, "MasterPublicIP-Windows", {
    //   value: windows.instancePublicIp,
    // });
    // new CfnOutput(this, "MasterID-Windows", {
    //   value: windows.instanceId,
    // });

    new CfnOutput(this, "MasterPublicIP", {
      value: instance.instancePublicIp,
    });
    new CfnOutput(this, "MasterID", {
      value: instance.instanceId,
    });
  }
}

export default { DevStack };
