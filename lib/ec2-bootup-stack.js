// const sqs = require('aws-cdk-lib/aws-sqs');
const cdk = require("aws-cdk-lib");
const ec2 = require("aws-cdk-lib/aws-ec2");
const iam = require("aws-cdk-lib/aws-iam");

require("dotenv").config();

class Ec2BootupStack extends cdk.Stack {
  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    // The code that defines your stack goes here

    const vpc = ec2.Vpc.fromLookup(this, "main-vpc", {
      vpcName: "main-vpc",
    });

    const sg = ec2.SecurityGroup.fromLookupByName(
      this,
      "launch-wizard-2",
      "launch-wizard-2"
    );

    const instance = new ec2.Instance(this, "simple-instance-1", {
      vpc: vpc,
      role: iam.Role.fromRoleName(this, "my-role", "ec2-master"),
      securityGroup: sg,
      instanceName: "simple-instance-1",
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.MEDIUM
      ),
      machineImage: ec2.MachineImage.genericLinux({
        "eu-central-1": "ami-0faab6bdbac9486fb",
      }),
      requireImdsv2: true,
      keyName: "slave", // we will create this in the console before we deploy,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC, // This is need in order for SubnetFilters to be able to find public Subnets
        subnetFilters: [
          ec2.SubnetFilter.byIds(
            "subnet-031e2d9267d8d6516"
            // "subnet-0595c3ffd520b3726"
          ),
        ],
      },
    });

    new ec2.CfnEIP(this, "my-eip", { instanceId: instance.instanceId });

    new cdk.CfnOutput(this, "simple-instance-1-output", {
      value: instance.instancePublicIp,
    });
  }
}

module.exports = { Ec2BootupStack };
