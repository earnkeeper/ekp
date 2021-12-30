import {
  ADD_LAYERS,
  chainIds,
  chains,
  ClientStateChangedEvent,
  CLIENT_STATE_CHANGED,
  CoingeckoService,
  CoinPrice,
  CurrencyDto,
  formatters,
  LayerDto,
  logger,
  moralis,
  MoralisService,
} from '@app/sdk';
import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { validate } from 'bycontract';
import { ethers } from 'ethers';
import _ from 'lodash';
import moment from 'moment';
import { defaultLogo } from '../util/constants';
import { TokenContractDocument } from './dtos';

@Injectable()
export class TokenClientService {
  constructor(
    private coingeckoService: CoingeckoService,
    private eventEmitter: EventEmitter2,
    private moralisService: MoralisService,
  ) {}

  private validateEvent(event: ClientStateChangedEvent) {
    const clientId = validate(event.clientId, 'string');

    const selectedCurrency = validate(
      event.state?.client.selectedCurrency,
      'object',
    );

    const watchedWallets = validate(
      event.state?.client.watchedWallets,
      'Array.<object>',
    );

    return {
      clientId,
      selectedCurrency,
      watchedWallets,
    };
  }

  @OnEvent(CLIENT_STATE_CHANGED)
  async handleClientStateChangedEvent(
    clientStateChangedEvent: ClientStateChangedEvent,
  ) {
    try {
      const { clientId, selectedCurrency, watchedWallets } = this.validateEvent(
        clientStateChangedEvent,
      );

      //#region get token balances
      const requestPromises = [];

      for (const chainId of chainIds) {
        for (const watchedWallet of watchedWallets) {
          const address = validate(watchedWallet.address, 'string');

          requestPromises.push(this.moralisService.tokensOf(chainId, address));
        }
      }

      const tokenBalances: moralis.TokenBalance[] = _.flatten(
        await Promise.all(requestPromises),
      );
      //#endregion

      //#region get fiat prices
      const coinIds = tokenBalances
        .map((it) =>
          this.coingeckoService.coinIdOf(it.chain_id, it.token_address),
        )
        .filter((it) => !!it);

      const coinPrices = await this.coingeckoService.latestPricesOf(
        coinIds,
        selectedCurrency.id,
      );
      //#endregion

      //#region format tokens
      const tokens = this.mapTokenContractDocuments(
        tokenBalances,
        selectedCurrency,
        coinPrices,
      );
      //#endregion

      //#region emit tokens
      for (const token of tokens) {
        this.fillAndEmitContract(clientId, token);
      }
      //#endregion

      //#region remove old tokens
      //#endregion

      //#region emit token stats
      const totalValue = _.sumBy(
        tokens,
        (token) => token.priceFiat * token.balance,
      );

      const now = moment().unix();

      const layers = <LayerDto[]>[
        {
          id: `token-stats`,
          collectionName: 'portfolioStats',
          timestamp: now,
          set: [
            {
              id: 'token_value',
              created: now,
              updated: now,
              name: 'Token Value',
              value: formatters.currencyValue(
                totalValue,
                selectedCurrency.symbol,
              ),
            },
          ],
        },
      ];

      this.eventEmitter.emit(ADD_LAYERS, {
        channelId: clientId,
        layers,
      });
      //#endregion
    } catch (error) {
      logger.error(
        `(TokenClientService) Error occurred handling client state.`,
      );
      logger.error(error);
    }
  }

  private async fillAndEmitContract(
    clientId: string,
    token: TokenContractDocument,
  ) {
    const imageUrl = !!token.coinId
      ? await this.coingeckoService.getImageUrl(token.coinId)
      : undefined;

    const updatedToken = {
      ...token,
      logo: imageUrl ?? defaultLogo,
    };

    const layers = <LayerDto[]>[
      {
        id: `token-contract-${token.id}`,
        collectionName: 'tokens',
        set: [updatedToken],
      },
    ];

    this.eventEmitter.emit(ADD_LAYERS, {
      channelId: clientId,
      layers,
    });
  }

  private mapTokenContractDocuments(
    tokenBalances: moralis.TokenBalance[],
    selectedCurrency: CurrencyDto,
    coinPrices: CoinPrice[],
  ): TokenContractDocument[] {
    const tokensById = _.groupBy(
      tokenBalances,
      (tokenBalance) =>
        `${tokenBalance.chain_id}_${tokenBalance.token_address}`,
    );

    const now = moment().unix();

    return Object.entries(tokensById)
      .map(([id, tokens]) => {
        const balance = _.sumBy(tokens, (token) =>
          Number(ethers.utils.formatUnits(token.balance, token.decimals)),
        );

        const chainMetadata = chains[tokens[0].chain_id];

        const coinId = this.coingeckoService.coinIdOf(
          tokens[0].chain_id,
          tokens[0].token_address,
        );

        if (!coinId) {
          return undefined;
        }

        const coinPrice = coinPrices.find(
          (it) => it.coinId.toLowerCase() === coinId,
        );

        return {
          id,
          created: now,
          updated: now,
          allowSwap: !!coinPrice,
          allowBurnToken: !!coinPrice,
          balance,
          chain: {
            id: chainMetadata.id,
            logo: chainMetadata.logo,
            name: chainMetadata.name,
          },
          coinId,
          contractAddress: tokens[0].token_address,
          decimals: Number(tokens[0].decimals),
          fiatSymbol: selectedCurrency.symbol,
          links: {
            swap: `${chainMetadata.swap}?inputCurrency=${tokens[0].token_address}`,
            token: !!coinId
              ? `https://www.coingecko.com/en/coins/${coinId}`
              : `${chainMetadata}token/${tokens[0].token_address}`,
          },
          logo: tokens[0].logo,
          name: tokens[0].name,
          priceFiat: coinPrice?.price,
          symbol: tokens[0].symbol,
          valueFiat: {
            _eval: true,
            scope: {
              price: '$.priceFiat',
              balance: '$.balance',
            },
            expression: 'balance * price',
          },
        };
      })
      .filter((it) => !!it);
  }
}