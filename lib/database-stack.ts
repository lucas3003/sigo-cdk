import * as cdk from '@aws-cdk/core'
import * as iam from '@aws-cdk/aws-iam';
import * as dynamodb from "@aws-cdk/aws-dynamodb";

interface DatabaseStackProps extends cdk.StackProps {
    readWritePermissions: iam.IRole[]
}

export class DatabaseStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props?: DatabaseStackProps) {
        super(scope, id, props);

        const partitionKey = { name: "id", type: dynamodb.AttributeType.STRING };

        const tables = [
            {
                name: "Sales",
                partitionKey,
                sortKey: {name: "productId", type:dynamodb.AttributeType.STRING}
            },
            {
                name: "Supplies",
                partitionKey,
                sortKey: { name: "qty", type: dynamodb.AttributeType.NUMBER }
            },
            {
                name: "Products",
                partitionKey,
                sortKey: { name: "description", type: dynamodb.AttributeType.STRING }
            },
            {
                name: "Production",
                partitionKey,
                sortKey: { name: "description", type: dynamodb.AttributeType.STRING }
            }
        ]

        tables.forEach(async table => {
            const t = await this.createTable(table.name, table.partitionKey, table.sortKey);    
            props?.readWritePermissions.forEach(permission => 
                t.grantReadWriteData(permission)
            );    
        });
    }

    async createTable(name: string, partitionKey: any, sortKey: any) {
        return new dynamodb.Table(this, name, {
            tableName: name,
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            partitionKey,
            sortKey,
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });
    }
}