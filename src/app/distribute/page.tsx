import Dynamic from "@/components/Dynamic";
import DeployAndEmail from "@/components/DeployAndEmail";
import { NextPage } from "next";

interface Props {}

const DistributePage: NextPage<Props> = ({}) => {
    return (
        <Dynamic>
            <div className="flex flex-col items-center w-full">
                <div className="bg-yellow-500/20 text-yellow-600 border border-yellow-500/50 p-4 m-4 rounded-md text-center w-full max-w-4xl font-semibold">
                    🚧 This feature is currently under construction. Contributions to improve or fix it are welcome! 🚧
                </div>
                <DeployAndEmail />
            </div>
        </Dynamic>
    );
};

export default DistributePage;
