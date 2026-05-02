export default function Tabs({
  tabs,
  activeTab,
  onTabChange,
  className = '',
}) {
  return (
    <div className={`flex flex-wrap gap-3 mb-4 ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
