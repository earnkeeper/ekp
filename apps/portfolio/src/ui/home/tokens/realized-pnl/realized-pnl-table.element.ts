export default function element() {
  return [
    {
      view: 'datatable',
      items: '$.token_pnl_summaries.*',
      options: {
        defaultSortFieldId: 'realizedGain',
        defaultSortAsc: false,
        filterable: false,
      },
      columns: [
        {
          id: 'token',
          value: '$.token.symbol',
          sortable: true,
          cell: [
            {
              view: 'tile',
              left: [
                {
                  view: 'image',
                  src: '$.token.logo',
                  size: 28,
                },
              ],
              title: '$.token.symbol',
            },
          ],
        },
        {
          id: 'costBasis',
          value: '$.costBasis.fiat',
          grow: 0,
          sortable: true,
          label: {
            value: '$.costBasis.fiat',
            formatter: 'currency',
            symbol: '$.fiatSymbol',
          },
        },
        {
          id: 'realizedValue',
          value: '$.realizedValue',
          sortable: true,
          grow: 0,
          label: {
            value: '$.realizedValue',
            formatter: 'currency',
            symbol: '$.fiatSymbol',
          },
        },
        {
          id: 'realizedGain',
          value: '$.realizedGain',
          sortable: true,
          grow: 0,
          label: {
            value: '$.realizedGain',
            formatter: 'currency',
            symbol: '$.fiatSymbol',
          },
        },
        {
          id: 'actions',
          compact: true,
          name: '',
          width: '22px',
          actions: [
            {
              icon: 'cil-external-link',
              name: 'View Transactions',
              rpc: {
                method: 'ek_openLink',
                params: ['$.links.transactions'],
              },
            },
          ],
        },
      ],
    },
  ];
}
