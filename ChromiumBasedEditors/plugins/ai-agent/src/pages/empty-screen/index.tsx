import { AddModelCard } from "@/components/model-config-cards";
import useRouter from "@/store/useRouter";

const EmptyScreen = () => {
  const { goToChat } = useRouter();

  return (
    <div className="flex justify-center p-[24px]">
      <div className="max-w-[480px] w-full">
        <AddModelCard variant="standalone" onSuccess={goToChat} />
      </div>
    </div>
  );
};

export default EmptyScreen;
