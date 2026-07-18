// frappe-gantt(MIT)は型定義を同梱しないためのアンビエント宣言（#95）。
// 実利用は any キャストで動的importするため最小限の宣言に留める。
declare module "frappe-gantt" {
  const Gantt: any;
  export default Gantt;
}
