import { AddModelCard } from "../../components/model-config-cards";
import { useStores } from "../../store/context";

const EmptyScreen = () => {
  const { useRouter } = useStores();
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
