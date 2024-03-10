// const sqs = require('aws-cdk-lib/aws-sqs');
import { CfnOutput, Stack } from "aws-cdk-lib";
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
} from "aws-cdk-lib/aws-ec2";
import {
  AccountRootPrincipal,
  ManagedPolicy,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  ObjectOwnership,
} from "aws-cdk-lib/aws-s3";

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
      role: instanceProfile,
      securityGroup: sg,
      instanceName: "master",
      instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MEDIUM),
      machineImage: MachineImage.genericLinux({
        "eu-central-1": "ami-0faab6bdbac9486fb",
      }),
      requireImdsv2: true,
      keyPair: KeyPair.fromKeyPairName(
        this,
        "KeyPair",
        process.env.AWS_EC2_KEY
      ), // Create this in the console before deploying
      vpcSubnets: {
        subnetType: SubnetType.PUBLIC, // This is need in order for SubnetFilters to be able to find public Subnets
      },
    });

    instance.addUserData(
      `curl '${process.env.AWS_EC2_USERDATA}' -o './bootstrap.sh' && sh ./bootstrap.sh && rm -rf ./bootstrap.sh`,
      `su - ubuntu -c "git config --global user.name '${process.env.GIT_USER}' && git config --global user.email '${process.env.GIT_EMAIL}'"`
    );

    new CfnEIP(this, "ElasticIP", { instanceId: instance.instanceId });

    new CfnOutput(this, "MasterPublicIP", {
      value: instance.instancePublicIp,
    });
    new CfnOutput(this, "MasterID", {
      value: instance.instanceId,
    });
  }
}

export default { DevStack };
